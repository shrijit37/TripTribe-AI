// Shared Better Auth service (auth.shrijit.tech). The session cookie is set on
// Domain=.shrijit.tech, so credentials:'include' carries it to this origin and
// every *.shrijit.tech API — no token handling, no local user store.
export const AUTH_URL = import.meta.env.VITE_AUTH_URL || "https://auth.shrijit.tech";

async function call(path, body) {
  const res = await fetch(`${AUTH_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || "Sign-in failed");
  return data;
}

export const getSession = () => call("/api/auth/get-session");
export const signOut = () => call("/api/auth/sign-out", {});
export const signInWithEmail = (email, password) =>
  call("/api/auth/sign-in/email", { email, password });
export const signUpWithEmail = (email, password, name) =>
  call("/api/auth/sign-up/email", { email, password, name });
export const signInWithProvider = (provider) =>
  call("/api/auth/sign-in/social", { provider, callbackURL: window.location.origin });
