// Shared Better Auth service (auth.shrijit.tech). The session cookie is set on
// Domain=.shrijit.tech, so credentials:'include' carries it to this origin and
// every *.shrijit.tech API — no token handling, no local user store.
import type { AuthSession } from "./types";

export const AUTH_URL =
  process.env.NEXT_PUBLIC_AUTH_URL ?? "https://auth.shrijit.tech";

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${AUTH_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = (await res.json().catch(() => null)) as { message?: string } | null;
  if (!res.ok) throw new Error(data?.message ?? "Sign-in failed");
  return data as T;
}

export const getSession = () => call<AuthSession>("/api/auth/get-session");
export const signOut = () => call<unknown>("/api/auth/sign-out", {});
export const signInWithEmail = (email: string, password: string) =>
  call<AuthSession>("/api/auth/sign-in/email", { email, password });
export const signUpWithEmail = (email: string, password: string, name: string) =>
  call<AuthSession>("/api/auth/sign-up/email", { email, password, name });
export const signInWithProvider = (provider: string) =>
  call<unknown>("/api/auth/sign-in/social", {
    provider,
    callbackURL: window.location.origin,
  });