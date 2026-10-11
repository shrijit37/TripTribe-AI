import "server-only";
import { cookies } from "next/headers";
import { optional } from "@/server/env";
import {
  getOrCreate,
  type SessionIdentity,
} from "@/server/db/repositories/users";
import type { UserDoc } from "@/server/db/documents";

/**
 * Who is calling, resolved once per request.
 * The old `authenticate` middleware did a remote session fetch *and* a user
 * upsert on every authed request, then the controller re-queried the user —
 * two database trips for one answer. `getSession` fetches the session;
 * `getViewer` additionally returns the local profile from the upsert itself.
 * Nothing here reads the request body's `email`: identity comes only from the
 * Better Auth cookie (migration fix — the old `POST /api/itenary` saved trips
 * under whatever email the caller typed).
 *
 * A valid session is necessary but not sufficient: TripTribe is an org on a
 * shared auth service, so `ensureMember` is what turns "has a session on
 * auth.shrijit.tech" into "may use TripTribe". It was added to the Express
 * middleware and would have been dropped by this move if the port had stopped
 * at the session fetch — the kind of change that looks like plumbing and is
 * actually access control.
 */

/** Derived from `fetch` itself: naming `RequestInit` trips `no-undef`. */
type FetchInit = NonNullable<Parameters<typeof globalThis.fetch>[1]>;

export interface Viewer {
  identity: SessionIdentity;
  user: UserDoc;
}

const authUrl = (): string =>
  optional("AUTH_URL") ?? "https://auth.shrijit.tech";

/**
 * Is this caller a member of the TripTribe org?
 *
 * Membership self-joins on first visit, so this is two calls for a first-time
 * caller and one for everyone else. It returns false only when the auth hub is
 * unreachable, the org is unseeded, or TripTribe later flips to invite-only —
 * which means an auth-service outage locks people out rather than letting
 * anyone through. That is the correct direction to fail for an access check,
 * and it is why the failure is not swallowed into "assume yes".
 */
const ensureMember = async (cookie: string): Promise<boolean> => {
  const call = async (path: string, init?: FetchInit) => {
    try {
      const response = await fetch(`${authUrl()}${path}`, {
        ...init,
        headers: { cookie },
        cache: "no-store",
      });
      return response.ok
        ? ((await response.json()) as { member?: unknown })
        : null;
    } catch {
      return null;
    }
  };

  const member = await call("/api/orgs/triptribe/member");
  if (member?.member) return true;
  const joined = await call("/api/orgs/triptribe/join", { method: "POST" });
  return Boolean(joined?.member);
};

const readSession = async (cookie: string): Promise<SessionIdentity | null> => {
  try {
    const response = await fetch(`${authUrl()}/api/auth/get-session`, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const session = (await response.json()) as {
      user?: { id?: string; email?: string; name?: string };
    };
    const user = session?.user;
    if (!user?.id || !user?.email) return null;
    return {
      authId: user.id,
      email: user.email,
      name: user.name ?? user.email,
    };
  } catch {
    return null;
  }
};

/** The cookie header, or null when there is no session cookie at all. */
const sessionCookie = async (): Promise<string | null> => {
  const jar = await cookies();
  const cookie = jar.toString();
  return cookie.includes("better-auth.session_token") ? cookie : null;
};

/**
 * The signed-in TripTribe identity, or null.
 *
 * Null covers three cases that callers treat differently in their copy but the
 * same in the type: no cookie, a cookie the auth service will not confirm, and
 * a valid session for someone who is not a member of the TripTribe org. No
 * database touched.
 */
export const getSession = async (): Promise<SessionIdentity | null> => {
  const cookie = await sessionCookie();
  if (!cookie) return null;
  const identity = await readSession(cookie);
  if (!identity) return null;
  return (await ensureMember(cookie)) ? identity : null;
};

/** The signed-in identity plus its local profile, or null. One DB round trip. */
export const getViewer = async (): Promise<Viewer | null> => {
  const identity = await getSession();
  if (!identity) return null;
  try {
    const user = await getOrCreate(identity);
    return { identity, user };
  } catch {
    return null;
  }
};
