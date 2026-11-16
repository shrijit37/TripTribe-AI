"use client";

/**
 * Browser-side Supabase client for the fleet project.
 *
 * Supabase Auth stores its session in localStorage by default, which the
 * server cannot read. Alongside that, we mirror the access token into a
 * same-site cookie (`sb-access-token`) on every auth event, so server route
 * handlers can verify it with `supabase.auth.getUser()` (see
 * `src/server/auth/session.ts`). The cookie is a transport copy only — the
 * refresh token stays in the SDK's localStorage store and never crosses the
 * wire to this app's own API.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://supabase.shrijit.tech/rjrynmjugsxuytpotfma";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_gB-4dti01NmMggaCj-o2cY-YsmWkw2_SxAiBHKaIoYQ_CyNbUZzt";

const ACCESS_TOKEN_COOKIE = "sb-access-token";

let browserClient: SupabaseClient | undefined;

/** Mirror the current access token into the cookie the server reads. */
export function syncToken(
  token: string | null | undefined,
  maxAge = 3600,
): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  if (token) {
    document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${Math.max(60, maxAge)}; SameSite=Lax${secure}`;
  } else {
    document.cookie = `${ACCESS_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  }
}

/** The singleton browser client, created on first use. */
export function getSupabase(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    browserClient.auth.onAuthStateChange((_event, session) => {
      syncToken(session?.access_token, session?.expires_in);
    });
  }
  return browserClient;
}
