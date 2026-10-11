/**
 * The one place the app talks to its own backend — which is now itself.
 *
 * The whole backend moved into this Next.js app, so `/api/*` is same-origin and
 * served by this very deployment. Every URL below is a relative path: there is
 * no `NEXT_PUBLIC_ITENARY_API_URL`, no nginx `proxy_pass`, and no second
 * container to disagree with the build about where the API lives. (The old
 * client had to be told at build time, and CI got it wrong — `AUTH_URL` and
 * `BACKEND_URL` pointed at two different service names in the same deploy.)
 */
import type {
  CityImageResponse,
  PlanErrorDetail,
  PlanPayload,
  PlanRequest,
  TripsApiRecord,
} from "./types";

/**
 * A 400 names the offending fields; anything else is not the user's input and
 * must not be described as though it were. So the caller gets the detail list
 * when there is one and a generic failure otherwise — the Result and Search
 * pages both branch on this.
 */
export class PlanRequestError extends Error {
  readonly status: number;
  readonly details: PlanErrorDetail[];

  constructor(
    status: number,
    message: string,
    details: PlanErrorDetail[] = [],
  ) {
    super(message);
    this.name = "PlanRequestError";
    this.status = status;
    this.details = details;
  }
}

export async function postItinerary(input: PlanRequest): Promise<PlanPayload> {
  const res = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    // The body is best-effort: a 502 from the platform proxy has no JSON at
    // all, and reading it must not turn one failure into another.
    //
    // The field is `error`, not `message`. The old client read `body.message`,
    // which no endpoint has ever sent, so every failure — including ones with
    // perfectly good copy in the body — rendered as "Itinerary request failed".
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      code?: string;
      details?: PlanErrorDetail[];
    } | null;
    throw new PlanRequestError(
      res.status,
      body?.error ?? "Itinerary request failed",
      Array.isArray(body?.details) ? body.details : [],
    );
  }

  return (await res.json()) as PlanPayload;
}

const FALLBACK_IMAGE = "https://picsum.photos/1920/1080?grayscale&random=2";

/**
 * The city photograph. Falls back to the same placeholder the Result page has
 * always used when Custom Search has nothing usable — an image is decoration
 * here, so a miss must not take the page down with it.
 */
export async function fetchCityImage(query: string): Promise<string> {
  try {
    const res = await fetch(
      `/api/plan/image?query=${encodeURIComponent(query)}`,
    );
    if (!res.ok) return FALLBACK_IMAGE;
    const data = (await res.json()) as CityImageResponse;
    const link = data.items?.[1]?.link ?? data.items?.[0]?.link;
    // `/api/image` is the allowlisted proxy: the old `proxy-image?url=` accepted
    // any address, which made this page an open fetch on behalf of whoever
    // could reach it.
    return link ? `/api/image?url=${encodeURIComponent(link)}` : FALLBACK_IMAGE;
  } catch {
    return FALLBACK_IMAGE;
  }
}

export { FALLBACK_IMAGE };

/** The authenticated trip history. Returns `null` when the call fails. */
export async function fetchTrips(): Promise<TripsApiRecord[] | null> {
  try {
    const res = await fetch("/api/trips", { credentials: "same-origin" });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? (data as TripsApiRecord[]) : [];
  } catch {
    return null;
  }
}

/**
 * Set the delivery address on a trip, for the email hand-off.
 * Returns null on failure; the caller decides whether that is worth a message.
 */
export async function saveTripEmail(
  tripId: string,
  userEmail: string,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userEmail }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Send a generated plan to an inbox. */
export async function emailPlan(
  tripUuid: string,
  to?: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("/api/plan/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(to ? { tripUuid, to } : { tripUuid }),
    });
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    return {
      ok: res.ok,
      message: body?.error ?? (res.ok ? "Sent" : "Could not send that email"),
    };
  } catch {
    return { ok: false, message: "Could not send that email" };
  }
}

/** Re-plan one saved day. `scope` is "day" | "meals" | "order". */
export async function regenerateDay(
  tripId: string,
  dayIndex: number,
  scope: "day" | "meals" | "order",
): Promise<PlanPayload | null> {
  try {
    const res = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayIndex, scope }),
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as PlanPayload;
  } catch {
    return null;
  }
}

/**
 * The app's own profile (`GET /api/profile`) — the port of Express
 * `GET /profile`. Identity comes from the session cookie; the body is the
 * editable copy TripTribe keeps. Returns `null` when signed out or unreachable,
 * so callers keep "signed out" and "broken" apart the way `fetchTrips` does.
 */
import type { UserProfile } from "./types";

export async function fetchProfile(): Promise<UserProfile | null> {
  try {
    const res = await fetch("/api/profile", { credentials: "same-origin" });
    if (!res.ok) return null;
    return (await res.json()) as UserProfile;
  } catch {
    return null;
  }
}

export async function updateProfile(
  patch: Partial<Pick<UserProfile, "fname" | "lname" | "userInterest" | "userAddress">>,
): Promise<{ ok: boolean; profile?: UserProfile; message: string }> {
  try {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = (await res.json().catch(() => null)) as (UserProfile & {
      error?: string;
    }) | null;
    if (!res.ok) {
      return {
        ok: false,
        message:
          (body as { error?: string } | null)?.error ??
          "Could not save your profile",
      };
    }
    return { ok: true, profile: body as UserProfile, message: "Saved" };
  } catch {
    return { ok: false, message: "Could not save your profile" };
  }
}

/** Delete TripTribe's own copy (profile + trips). Auth identity first. */
export async function deleteProfile(): Promise<boolean> {
  try {
    const res = await fetch("/api/profile", {
      method: "DELETE",
      credentials: "same-origin",
    });
    return res.ok;
  } catch {
    return false;
  }
}
