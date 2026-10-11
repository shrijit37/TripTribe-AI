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

/**
 * Password reset + email verification, same transport as sign-in.
 * Endpoint names follow Better Auth (`/request-password-reset`,
 * `/reset-password`, `/send-verification-email`, `/verify-email`); the
 * redirect targets stay same-origin so a token never leaves triptribe.
 */
export const requestPasswordReset = (email: string) =>
  call<unknown>("/api/auth/request-password-reset", {
    email,
    redirectTo: `${window.location.origin}/auth/reset`,
  });

export const resetPassword = (newPassword: string, token: string) =>
  call<unknown>("/api/auth/reset-password", { newPassword, token });

export const sendVerificationEmail = (email: string) =>
  call<unknown>("/api/auth/send-verification-email", {
    email,
    callbackURL: `${window.location.origin}/auth/verify`,
  });

export const verifyEmail = (token: string) =>
  call<unknown>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);

export const changePassword = (newPassword: string, currentPassword: string) =>
  call<unknown>("/api/auth/change-password", {
    newPassword,
    currentPassword,
    revokeOtherSessions: true,
  });

export const updateAuthUser = (name: string) =>
  call<unknown>("/api/auth/update-user", { name });

/**
 * Hard-delete the Better Auth identity. Disabled by default on the auth
 * service — when it answers 404/403 the caller falls back to deleting only
 * TripTribe's own copy (`DELETE /api/profile`). Never throws a raw 404 at
 * the UI: the message names the fallback.
 */
export const deleteAuthUser = async (): Promise<{ authDeleted: boolean }> => {
  try {
    await call<unknown>("/api/auth/delete-user", {});
    return { authDeleted: true };
  } catch (error) {
    if (
      error instanceof Error &&
      /not found|forbidden|not enabled/i.test(error.message)
    ) {
      return { authDeleted: false };
    }
    throw error;
  }
};
