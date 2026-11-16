/**
 * Authentication for the browser, backed by the fleet Supabase project.
 *
 * The old client called a shared Better Auth hub on auth.shrijit.tech with a
 * cross-site session cookie. Supabase owns identity now: email/password and
 * GitHub/Google OAuth go through `supabase.auth`, the SDK persists the session
 * locally, and `syncToken` mirrors the access token into a cookie that the
 * server verifies (src/server/auth/session.ts). Function names and return
 * shapes are unchanged so the existing Auth/Account/Reset/Verify screens keep
 * working against Supabase.
 */
import type { User } from "@supabase/supabase-js";
import { getSupabase, syncToken } from "./supabaseClient";
import type { AuthSession, UserInfo } from "./types";

/** Supabase messages mapped to the copy keys the screens already translate. */
function friendly(message: string): string {
  const value = message.toLowerCase();
  if (value.includes("invalid login credentials")) {
    return "INVALID_EMAIL_OR_PASSWORD";
  }
  if (value.includes("email not confirmed")) return "EMAIL_NOT_VERIFIED";
  if (value.includes("already registered") || value.includes("already exists")) {
    return "USER_ALREADY_EXISTS";
  }
  if (value.includes("user not found")) return "USER_NOT_FOUND";
  return message;
}

/** Map a Supabase user into the app's own `UserInfo` shape. */
function toUserInfo(user: User | null | undefined): UserInfo | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    typeof meta.name === "string"
      ? meta.name
      : typeof meta.full_name === "string"
        ? meta.full_name
        : undefined;
  const image = typeof meta.avatar_url === "string" ? meta.avatar_url : undefined;
  return { email: user.email ?? "", name, image };
}

/** Current session, or an empty one. Keeps the AuthProvider refresh simple. */
export async function getSession(): Promise<AuthSession> {
  const { data } = await getSupabase().auth.getSession();
  syncToken(data.session?.access_token, data.session?.expires_in);
  return {
    user: toUserInfo(data.session?.user),
    session: data.session,
  };
}

export async function signOut(): Promise<void> {
  syncToken(null);
  await getSupabase().auth.signOut();
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthSession> {
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(friendly(error.message));
  syncToken(data.session?.access_token, data.session?.expires_in);
  return { user: toUserInfo(data.user), session: data.session };
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
): Promise<AuthSession> {
  const redirectTo = `${window.location.origin}/auth/verify`;
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    options: { data: { name }, emailRedirectTo: redirectTo },
  });
  if (error) throw new Error(friendly(error.message));
  // When email confirmation is on, no session is returned until the link is
  // opened — which is exactly the "check your email" state the screen shows.
  syncToken(data.session?.access_token, data.session?.expires_in);
  return { user: toUserInfo(data.user), session: data.session };
}

/** GitHub / Google OAuth (the buttons in components/AuthProviders.tsx). */
export async function signInWithProvider(provider: string): Promise<void> {
  const id = provider === "google" || provider === "github" ? provider : "github";
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: id,
    options: { redirectTo: window.location.origin },
  });
  if (error) throw new Error(friendly(error.message));
  // Supabase navigates to the provider; onAuthStateChange writes the token
  // cookie on the way back.
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset`,
  });
  if (error) throw new Error(friendly(error.message));
}

export async function resetPassword(
  newPassword: string,
  token: string,
): Promise<void> {
  const supabase = getSupabase();
  const verified = await supabase.auth.verifyOtp({
    token_hash: token,
    type: "recovery",
  });
  if (verified.error) throw new Error(friendly(verified.error.message));
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(friendly(error.message));
  syncToken(
    (await supabase.auth.getSession()).data.session?.access_token,
  );
}

export async function sendVerificationEmail(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/verify` },
  });
  if (error) throw new Error(friendly(error.message));
}

export async function verifyEmail(token: string): Promise<void> {
  const { error } = await getSupabase().auth.verifyOtp({
    token_hash: token,
    type: "email",
  });
  if (error) throw new Error(friendly(error.message));
}

export async function changePassword(
  newPassword: string,
  _currentPassword: string,
): Promise<void> {
  // Supabase verifies the caller via the current access token; the old hub's
  // separate "current password" check no longer applies.
  const { error } = await getSupabase().auth.updateUser({
    password: newPassword,
  });
  if (error) throw new Error(friendly(error.message));
}

export async function updateAuthUser(name: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ data: { name } });
  if (error) throw new Error(friendly(error.message));
}

/**
 * Supabase's client SDK has no self-service delete; that needs the service
 * role (an admin API the browser must never hold). The caller already deletes
 * TripTribe's own profile next, so report the fallback rather than throwing.
 */
export async function deleteAuthUser(): Promise<{ authDeleted: boolean }> {
  return { authDeleted: false };
}
