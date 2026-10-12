"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sendVerificationEmail, verifyEmail } from "@/lib/auth-client";
import "../mx-auth.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = "idle" | "verifying" | "verified" | "failed";

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
    <main className="mx-au-page">
      <div className="mx-au-grid">
        <section className="mx-au-sheet" aria-labelledby="mx-au-verify-title">
          <h1 id="mx-au-verify-title" className="mx-au-title">
            Verify your email
          </h1>

          {status === "verifying" && (
            <p className="mx-au-note" role="status">
              Checking that link…
            </p>
          )}

          {status === "verified" && (
            <div>
              <h2 className="mx-au-head2">Verified — sign in</h2>
              <p className="mx-au-hint">
                The address is confirmed. Sign in with the same email and password you
                registered with.
              </p>
              <div className="mx-au-actions">
                <button type="button" className="mx-au-btn" onClick={() => router.push("/auth")}>
                  Go to sign in
                </button>
              </div>
            </div>
          )}

          {(status === "failed" || (status === "idle" && !sent)) && (
            <>
              {note && (
                <p className="mx-au-error" role="alert">
                  {note}
                </p>
              )}
              <div className="mx-au-rows">
                <div className="mx-au-row">
                  <label htmlFor="mx-au-verify-email">Email</label>
                  <input
                    id="mx-au-verify-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="mx-au-actions">
                <button type="button" className="mx-au-btn" disabled={busy} onClick={resend}>
                  {busy ? "Sending…" : "Re-send verification link"}
                </button>
                <p className="mx-au-note">
                  One link per request — the newest link is the one that counts.
                </p>
              </div>
            </>
          )}

          {sent && status !== "verified" && (
            <div>
              <h2 className="mx-au-head2">Check your email</h2>
              <p className="mx-au-hint">A fresh link is on its way to</p>
              <p className="mx-au-sentto">{sent}</p>
            </div>
          )}

          <button type="button" className="mx-au-back" onClick={() => router.push("/auth")}>
            Back to the account
          </button>
        </section>

        <aside className="mx-au-margin" aria-label="Why verification">
          <h2 className="mx-au-head2" style={{ marginTop: 0 }}>
            Why verification
          </h2>
          <p className="mx-au-hint">
            Trips are filed under your address, so the account checks the address is yours
            before it signs anything in. A link that has expired or already been used says
            so plainly — request a fresh one rather than retrying the old.
          </p>
        </aside>
      </div>
    </main>
  );
}
