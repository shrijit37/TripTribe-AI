"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Coastline from "@/components/Coastline";
import { sendVerificationEmail, verifyEmail } from "@/lib/auth-client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = "idle" | "verifying" | "verified" | "failed";

/**
 * `/auth/verify` — the dedicated token landing.
 * `/auth` only notes "check your email"; this is where the link lands:
 * expired, used, and already-verified tokens each get their own verdict and
 * a resend from the address already on file, in the same turnstile grammar.
 */
export default function Verify({
  token,
  linkError,
}: {
  token?: string;
  linkError?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(token ? "verifying" : "idle");
  const [note, setNote] = useState(linkError ? "That link is not valid." : "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");

  useEffect(() => {
    if (!token) return;
    let live = true;
    (async () => {
      try {
        await verifyEmail(token);
        if (live) {
          setStatus("verified");
          setNote("");
        }
      } catch (err) {
        if (live) {
          setStatus("failed");
          setNote(err instanceof Error ? err.message : "That link did not verify.");
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [token]);

  const resend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setNote("Enter the email address you registered with.");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      await sendVerificationEmail(trimmed);
      setSent(trimmed);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not re-send that link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="tt-page">
      <section className="tt-turnstile" aria-labelledby="tt-verify-title">
        <div className="tt-rail">
          <div className="tt-turnstile__spread">
            <div className="tt-turnstile__lobe tt-turnstile__lobe--form">
              <div className="tt-gate">
                <div className="tt-gate__head">
                  <h1 id="tt-verify-title" className="tt-gate__title">
                    Verify your email
                  </h1>
                  <p className="tt-gate__ref">
                    <span>TT</span>
                    <span className="tt-gate__slash">/</span>
                    <span>AUTH</span>
                  </p>
                </div>

                {status === "verifying" && (
                  <p className="tt-gate__need" role="status">
                    Checking that link…
                  </p>
                )}

                {status === "verified" && (
                  <div className="tt-gate__sent">
                    <h2 className="tt-gate__sent-title">Verified — sign in</h2>
                    <p className="tt-gate__sent-body">
                      The address is confirmed. Sign in with the same email and
                      password you registered with.
                    </p>
                    <div className="tt-gate__action">
                      <button type="button" className="tt-btn" onClick={() => router.push("/auth")}>
                        Go to sign in
                      </button>
                    </div>
                  </div>
                )}

                {(status === "failed" || (status === "idle" && !sent)) && (
                  <>
                    {note && (
                      <p className="tt-row__error tt-row__error--sheet" role="alert">
                        {note}
                      </p>
                    )}
                    <div className="tt-rows">
                      <div className="tt-row">
                        <label className="tt-row__label" htmlFor="tt-verify-email">
                          Email
                        </label>
                        <input
                          id="tt-verify-email"
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
                    <div className="tt-gate__action">
                      <button type="button" className="tt-btn" disabled={busy} onClick={resend}>
                        {busy ? "Sending…" : "Re-send verification link"}
                      </button>
                      <p className="tt-gate__need">
                        One link per request — the newest link is the one that counts.
                      </p>
                    </div>
                  </>
                )}

                {sent && status !== "verified" && (
                  <div className="tt-gate__sent">
                    <h2 className="tt-gate__sent-title">Check your email</h2>
                    <p className="tt-gate__sent-body">A fresh link is on its way to</p>
                    <p className="tt-gate__sent-to">{sent}</p>
                  </div>
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
                <h2 className="tt-margin__title">Why verification</h2>
                <p className="tt-margin__body">
                  Trips are filed under your address, so the account checks the
                  address is yours before it signs anything in. A link that has
                  expired or already been used says so plainly — request a fresh
                  one rather than retrying the old.
                </p>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
