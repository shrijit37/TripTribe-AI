"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Coastline from "@/components/Coastline";
import { requestPasswordReset, resetPassword } from "@/lib/auth-client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `/auth/reset` — two spans of one rule, like `/auth` itself.
 * Without `?token`: request the link (always answers "sent" wording that does
 * not reveal whether the address is registered). With `?token`: set the new
 * password. Token failures name the recovery: request a fresh link.
 */
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
    <main className="tt-page">
      <section className="tt-turnstile" aria-labelledby="tt-reset-title">
        <div className="tt-rail">
          <div className="tt-turnstile__spread">
            <div className="tt-turnstile__lobe tt-turnstile__lobe--form">
              <div className="tt-gate">
                <div className="tt-gate__head">
                  <h1 id="tt-reset-title" className="tt-gate__title">
                    Reset your password
                  </h1>
                  <p className="tt-gate__ref">
                    <span>TT</span>
                    <span className="tt-gate__slash">/</span>
                    <span>AUTH</span>
                  </p>
                </div>

                {done ? (
                  <div className="tt-gate__sent">
                    <h2 className="tt-gate__sent-title">Password set — sign in</h2>
                    <p className="tt-gate__sent-body">
                      Use the new password with the same email you registered with.
                    </p>
                    <div className="tt-gate__action">
                      <button type="button" className="tt-btn" onClick={() => router.push("/auth")}>
                        Go to sign in
                      </button>
                    </div>
                  </div>
                ) : token ? (
                  <form onSubmit={confirmReset} noValidate>
                    <div className="tt-rows">
                      <div className="tt-row">
                        <label className="tt-row__label" htmlFor="tt-reset-password">
                          New password
                        </label>
                        <input
                          id="tt-reset-password"
                          className="tt-row__input tt-row__input--secret"
                          type="password"
                          autoComplete="new-password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                      <div className="tt-row">
                        <label className="tt-row__label" htmlFor="tt-reset-confirm">
                          Confirm password
                        </label>
                        <input
                          id="tt-reset-confirm"
                          className="tt-row__input tt-row__input--secret"
                          type="password"
                          autoComplete="new-password"
                          placeholder="••••••••"
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                        />
                      </div>
                    </div>
                    {error && (
                      <p className="tt-row__error tt-row__error--sheet" role="alert">
                        {error}
                      </p>
                    )}
                    <div className="tt-gate__action">
                      <button type="submit" className="tt-btn" disabled={busy}>
                        {busy ? "Setting…" : "Set new password"}
                      </button>
                      <p className="tt-gate__need">
                        Links expire — a rejected link needs a fresh request, not a retry.
                      </p>
                    </div>
                  </form>
                ) : sentTo ? (
                  <div className="tt-gate__sent">
                    <h2 className="tt-gate__sent-title">Check your email</h2>
                    <p className="tt-gate__sent-body">
                      If that address is registered, a reset link is on its way to
                    </p>
                    <p className="tt-gate__sent-to">{sentTo}</p>
                    <p className="tt-gate__sent-body" style={{ marginTop: "1.1rem" }}>
                      Open it to set a new password.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={request} noValidate>
                    <div className="tt-rows">
                      <div className="tt-row">
                        <label className="tt-row__label" htmlFor="tt-reset-email">
                          Email
                        </label>
                        <input
                          id="tt-reset-email"
                          className="tt-row__input"
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
                      <p className="tt-row__error tt-row__error--sheet" role="alert">
                        {error}
                      </p>
                    )}
                    <div className="tt-gate__action">
                      <button type="submit" className="tt-btn" disabled={busy}>
                        {busy ? "Sending…" : "Send reset link"}
                      </button>
                      <p className="tt-gate__need">
                        One link per request — the newest link is the one that counts.
                      </p>
                    </div>
                  </form>
                )}

                <button
                  type="button"
                  className="tt-turnstile__back"
                  onClick={() => router.push("/auth")}
                >
                  Back to the account
                </button>
              </div>
            </div>

            <div className="tt-turnstile__coast">
              <Coastline />
            </div>

            <div className="tt-turnstile__lobe tt-turnstile__lobe--margin">
              <aside className="tt-margin">
                <h2 className="tt-margin__title">What resets, what doesn&apos;t</h2>
                <p className="tt-margin__body">
                  The link changes the password on the shared auth service — your
                  trips stay filed under the same address. TripTribe keeps no
                  password of its own, so there is nothing else to update.
                </p>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
