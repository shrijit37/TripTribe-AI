"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent, KeyboardEvent } from "react";
import AuthProviders from "@/components/AuthProviders";
import { useAuth } from "@/context/AuthProvider";
import {
  sendVerificationEmail,
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/auth-client";
import "../mx-auth.css";

const IconRoutes = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 18c5 0 5-12 10-12h5m0 0-3-3m3 3-3 3M4 18v2"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconMail = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 6h16v12H4zM4 7l8 6 8-6"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconArrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 12h15m0 0-6-6m6 6-6 6"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M20 12H5m0 0 6-6m-6 6 6 6"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const HOLDS = [
  {
    Icon: IconRoutes,
    name: "Your trips",
    body: "Every plan you generate is kept against your account and listed here, so the same trip opens again without researching it twice.",
  },
  {
    Icon: IconMail,
    name: "One address",
    body: "Your trips are filed under this address, which is how the account finds them again. Use one you check — it is what the verification link goes to.",
  },
];

const SIGNIN_ERRORS: Record<string, string> = {
  EMAIL_NOT_VERIFIED:
    "Verify your email first — open the link the sign-up mail sent you.",
  INVALID_EMAIL_OR_PASSWORD:
    "That email and password don't match. Check both, or register instead.",
  USER_NOT_FOUND: "No account on that email. Register instead.",
};

const SIGNUP_ERRORS: Record<string, string> = {
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "That email is already registered. Sign in with it instead.",
  USER_ALREADY_EXISTS: "That email is already registered. Sign in with it instead.",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = "signin" | "signup";

type Field = "email" | "password" | "confirm";

const Auth = () => {
  const router = useRouter();
  const { user, refresh } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fname, setFname] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState<Field | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [resendNote, setResendNote] = useState("");
  const [resending, setResending] = useState(false);

  const tabRefs = useRef<Record<Mode, HTMLButtonElement | null>>({
    signin: null,
    signup: null,
  });

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  const changeMode = (next: Mode) => {
    setMode(next);
    setError("");
    setInvalid(null);
    setSentTo("");
    setResendNote("");
    tabRefs.current[next]?.focus();
  };

  const onSegmentKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    changeMode(mode === "signin" ? "signup" : "signin");
  };

  const fail = (field: Field, message: string) => {
    setError(message);
    setInvalid(field);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setInvalid(null);

    const trimmed = email.trim();

    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      fail("email", "Enter the email address you registered with.");
      return;
    }
    if (!password) {
      fail("password", "Enter your password.");
      return;
    }

    if (mode === "signup") {
      if (password !== confirm) {
        fail("confirm", "The two passwords don't match. Retype them.");
        return;
      }
      setBusy(true);
      try {
        await signUpWithEmail(trimmed.toLowerCase(), password, fname.trim());
        setSentTo(trimmed);
      } catch (err) {
        fail("email", SIGNUP_ERRORS[(err as Error).message] || (err as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      await signInWithEmail(trimmed.toLowerCase(), password);
      await refresh();
      router.push("/");
    } catch (err) {
      fail("email", SIGNIN_ERRORS[(err as Error).message] || (err as Error).message);
      setBusy(false);
    }
  };

  const isSignUp = mode === "signup";

  return (
    <main className="mx-au-page">
      <div className="mx-au-grid">
        <section className="mx-au-sheet" aria-labelledby="mx-au-gate-title">
          <h1 id="mx-au-gate-title" className="mx-au-title">
            The account
          </h1>

          <div
            className="mx-au-segment"
            role="tablist"
            aria-label="Sign in or register"
            data-mode={mode}
          >
            <button
              type="button"
              role="tab"
              id="mx-au-tab-signin"
              className="mx-au-tab"
              aria-selected={!isSignUp}
              aria-controls="mx-au-gate-panel"
              tabIndex={isSignUp ? -1 : 0}
              ref={(el) => {
                tabRefs.current.signin = el;
              }}
              onClick={() => changeMode("signin")}
              onKeyDown={onSegmentKeyDown}
            >
              Sign in
              <span className="mx-au-tabnum" aria-hidden="true">
                01
              </span>
            </button>
            <button
              type="button"
              role="tab"
              id="mx-au-tab-signup"
              className="mx-au-tab"
              aria-selected={isSignUp}
              aria-controls="mx-au-gate-panel"
              tabIndex={isSignUp ? 0 : -1}
              ref={(el) => {
                tabRefs.current.signup = el;
              }}
              onClick={() => changeMode("signup")}
              onKeyDown={onSegmentKeyDown}
            >
              Register
              <span className="mx-au-tabnum" aria-hidden="true">
                02
              </span>
            </button>
          </div>

          {sentTo ? (
            <div>
              <h2 className="mx-au-head2">Check your email for the verification link</h2>
              <p className="mx-au-hint">The auth service sent a verification link to</p>
              <p className="mx-au-sentto">{sentTo}</p>
              <p className="mx-au-hint">
                Open it to finish setting up the account, then sign in here.
              </p>
              <div className="mx-au-actions">
                <button
                  type="button"
                  className="mx-au-btn"
                  onClick={() => {
                    setSentTo("");
                    changeMode("signin");
                  }}
                >
                  Go to sign in
                </button>
              </div>
            </div>
          ) : (
            <form
              id="mx-au-gate-panel"
              className="mx-au-form"
              role="tabpanel"
              aria-labelledby={isSignUp ? "mx-au-tab-signup" : "mx-au-tab-signin"}
              onSubmit={submit}
              noValidate
            >
              <div className="mx-au-providers">
                <AuthProviders disabled={busy} onError={setError} />
              </div>

              <p className="mx-au-or">or with email</p>

              <div className="mx-au-rows">
                {isSignUp && (
                  <div className="mx-au-row">
                    <label htmlFor="mx-au-auth-name">Name</label>
                    <input
                      id="mx-au-auth-name"
                      type="text"
                      autoComplete="name"
                      placeholder="How you want to be called"
                      value={fname}
                      onChange={(e) => setFname(e.target.value)}
                    />
                  </div>
                )}

                <div className="mx-au-row">
                  <label htmlFor="mx-au-auth-email">Email</label>
                  <input
                    id="mx-au-auth-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    aria-invalid={invalid === "email"}
                    aria-describedby={invalid === "email" ? "mx-au-auth-email-error" : undefined}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {invalid === "email" && (
                    <p className="mx-au-error" id="mx-au-auth-email-error" role="alert">
                      {error}
                    </p>
                  )}
                </div>

                <div className="mx-au-row">
                  <label htmlFor="mx-au-auth-password">Password</label>
                  <input
                    id="mx-au-auth-password"
                    className="mx-au-secret"
                    type="password"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    placeholder="••••••••"
                    value={password}
                    aria-invalid={invalid === "password"}
                    aria-describedby={
                      invalid === "password" ? "mx-au-auth-password-error" : undefined
                    }
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {invalid === "password" && (
                    <p className="mx-au-error" id="mx-au-auth-password-error" role="alert">
                      {error}
                    </p>
                  )}
                </div>

                {isSignUp && (
                  <div className="mx-au-row">
                    <label htmlFor="mx-au-auth-confirm">Confirm password</label>
                    <input
                      id="mx-au-auth-confirm"
                      className="mx-au-secret"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={confirm}
                      aria-invalid={invalid === "confirm"}
                      aria-describedby={
                        invalid === "confirm" ? "mx-au-auth-confirm-error" : undefined
                      }
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                    {invalid === "confirm" && (
                      <p className="mx-au-error" id="mx-au-auth-confirm-error" role="alert">
                        {error}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {error && !invalid && (
                <p className="mx-au-error" role="alert">
                  {error}
                </p>
              )}

              {!isSignUp && error.toLowerCase().includes("verify") && (
                <div className="mx-au-actions">
                  <button
                    type="button"
                    className="mx-au-btn mx-au-btn--quiet"
                    disabled={resending || !EMAIL_RE.test(email.trim())}
                    onClick={async () => {
                      setResending(true);
                      setResendNote("");
                      try {
                        await sendVerificationEmail(email.trim().toLowerCase());
                        setResendNote(
                          `Verification link re-sent to ${email.trim()}. Open it, then sign in.`
                        );
                      } catch (err) {
                        setResendNote(
                          err instanceof Error
                            ? err.message
                            : "Could not re-send that link right now."
                        );
                      } finally {
                        setResending(false);
                      }
                    }}
                  >
                    {resending ? "Re-sending…" : "Re-send verification link"}
                  </button>
                  {resendNote && (
                    <p className="mx-au-note" role="status">
                      {resendNote}
                    </p>
                  )}
                </div>
              )}

              <div className="mx-au-actions">
                <button type="submit" className="mx-au-btn" disabled={busy}>
                  {isSignUp ? "Register" : "Continue"}
                  <IconArrow />
                </button>
                <p className="mx-au-note">
                  {isSignUp
                    ? "A name is optional. The email and password are not."
                    : "Use the same email and password you registered with."}
                </p>
                {!isSignUp && (
                  <p className="mx-au-note">
                    <a href="/auth/reset">Forgot your password?</a>
                    {" · "}
                    <a href="/auth/verify">Verify your email</a>
                  </p>
                )}
              </div>
            </form>
          )}

          <button type="button" className="mx-au-back" onClick={() => router.push("/")}>
            <IconBack />
            Back to the route
          </button>
        </section>

        <aside className="mx-au-margin" aria-label="What the account holds">
          <h2 className="mx-au-head2" style={{ marginTop: 0 }}>
            What the account holds
          </h2>
          <p className="mx-au-hint">
            Planning a trip works signed out. An account is what makes the plan yours
            afterwards — reachable on any device, and still there when the group asks.
          </p>

          <ul className="mx-au-holds">
            {HOLDS.map(({ Icon, name, body }) => (
              <li className="mx-au-hold" key={name}>
                <span aria-hidden="true">
                  <Icon />
                </span>
                <div>
                  <h3 className="mx-au-holdname">{name}</h3>
                  <p className="mx-au-holdbody">{body}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mx-au-fine">
            Credentials are handled by the shared auth service at auth.shrijit.tech.
            TripTribe keeps no password of its own.
          </p>
        </aside>
      </div>
    </main>
  );
};

export default Auth;
