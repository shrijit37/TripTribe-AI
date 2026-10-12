"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { requestPasswordReset, resetPassword } from "@/lib/auth-client";
import "../mx-auth.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Reset({ token }: { token?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [done, setDone] = useState(false);

  const request = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter the email address you registered with.");
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(trimmed);
      setSentTo(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that link.");
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters for the new password.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match. Retype them.");
      return;
    }
    if (!token) {
      setError("That link has no token. Request a fresh one below.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(password, token);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} — request a fresh link and try again.`
          : "That link did not reset the password."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-au-page">
      <div className="mx-au-grid">
        <section className="mx-au-sheet" aria-labelledby="mx-au-reset-title">
          <h1 id="mx-au-reset-title" className="mx-au-title">
            Reset your password
          </h1>

          {done ? (
            <div>
              <h2 className="mx-au-head2">Password set — sign in</h2>
              <p className="mx-au-hint">
                Use the new password with the same email you registered with.
              </p>
              <div className="mx-au-actions">
                <button type="button" className="mx-au-btn" onClick={() => router.push("/auth")}>
                  Go to sign in
                </button>
              </div>
            </div>
          ) : token ? (
            <form onSubmit={confirmReset} noValidate>
              <div className="mx-au-rows">
                <div className="mx-au-row">
                  <label htmlFor="mx-au-reset-password">New password</label>
                  <input
                    id="mx-au-reset-password"
                    className="mx-au-secret"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="mx-au-row">
                  <label htmlFor="mx-au-reset-confirm">Confirm password</label>
                  <input
                    id="mx-au-reset-confirm"
                    className="mx-au-secret"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
              </div>
              {error && (
                <p className="mx-au-error" role="alert">
                  {error}
                </p>
              )}
              <div className="mx-au-actions">
                <button type="submit" className="mx-au-btn" disabled={busy}>
                  {busy ? "Setting…" : "Set new password"}
                </button>
                <p className="mx-au-note">
                  Links expire — a rejected link needs a fresh request, not a retry.
                </p>
              </div>
            </form>
          ) : sentTo ? (
            <div>
              <h2 className="mx-au-head2">Check your email</h2>
              <p className="mx-au-hint">
                If that address is registered, a reset link is on its way to
              </p>
              <p className="mx-au-sentto">{sentTo}</p>
              <p className="mx-au-hint">Open it to set a new password.</p>
            </div>
          ) : (
            <form onSubmit={request} noValidate>
              <div className="mx-au-rows">
                <div className="mx-au-row">
                  <label htmlFor="mx-au-reset-email">Email</label>
                  <input
                    id="mx-au-reset-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              {error && (
                <p className="mx-au-error" role="alert">
                  {error}
                </p>
              )}
              <div className="mx-au-actions">
                <button type="submit" className="mx-au-btn" disabled={busy}>
                  {busy ? "Sending…" : "Send reset link"}
                </button>
                <p className="mx-au-note">
                  One link per request — the newest link is the one that counts.
                </p>
              </div>
            </form>
          )}

          <button type="button" className="mx-au-back" onClick={() => router.push("/auth")}>
            Back to the account
          </button>
        </section>

        <aside className="mx-au-margin" aria-label="What resets, what doesn't">
          <h2 className="mx-au-head2" style={{ marginTop: 0 }}>
            What resets, what doesn&apos;t
          </h2>
          <p className="mx-au-hint">
            The link changes the password on the shared auth service — your trips stay
            filed under the same address. TripTribe keeps no password of its own, so there
            is nothing else to update.
          </p>
        </aside>
      </div>
    </main>
  );
}
