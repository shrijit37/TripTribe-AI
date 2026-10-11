import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Helmet } from "react-helmet";
import AuthProviders from "../components/AuthProviders";
import Coastline from "../components/Coastline";
import { useAuth } from "../context/AuthProvider";
import { signInWithEmail, signUpWithEmail } from "../lib/auth-client";

/* ─────────────────────────────────────────────────────────────────────────
   Icons — drawn at 24×24, one stroke weight, round caps. No glyph standing
   in for an icon system, on this surface or any other.
   ───────────────────────────────────────────────────────────────────────── */

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
      d="M3 7h18v10H3zM3 8l9 6 9-6"
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
      d="M5 12h13m0 0-5-5m5 5-5 5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M19 12H6m0 0 5-5m-5 5 5 5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ─────────────────────────────────────────────────────────────────────────
   The margin: what an account actually holds, and only that.

   Every line here is a fact the product can back (PRODUCT.md): trips persist
   per user and surface on the account, and the address on the account is the
   address plans are stored against. There are no testimonials, user counts or
   ratings anywhere on this page — none exist to print.

   Email hand-off is deliberately absent. PRODUCT.md records it as intended and
   the repo has no mail transport at all, so promising a delivered plan here
   would be claiming an unbuilt feature. The second row states what the address
   does today, which is what it actually does.
   ───────────────────────────────────────────────────────────────────────── */

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

/* Auth-service errors, said in the product's voice: name the constraint, name
   the recovery, never "invalid input". */
const SIGNIN_ERRORS = {
  EMAIL_NOT_VERIFIED:
    "Verify your email first — open the link the sign-up mail sent you.",
  INVALID_EMAIL_OR_PASSWORD:
    "That email and password don't match. Check both, or register instead.",
  USER_NOT_FOUND: "No account on that email. Register instead.",
};

const SIGNUP_ERRORS = {
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "That email is already registered. Sign in with it instead.",
  USER_ALREADY_EXISTS: "That email is already registered. Sign in with it instead.",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Auth = () => {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();

  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fname, setFname] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");

  const tabRefs = useRef({});

  // Already holding a session: there is nothing to do here, so this page gets
  // out of the way rather than showing a form over a signed-in state.
  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  // Switching modes clears the verdict rather than carrying one form's error into
  // the other's fields, and sends focus to the tab the visitor just chose.
  const changeMode = (next) => {
    setMode(next);
    setError("");
    setInvalid(null);
    setSentTo("");
    tabRefs.current[next]?.focus();
  };

  const onSegmentKeyDown = (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    changeMode(mode === "signin" ? "signup" : "signin");
  };

  const fail = (field, message) => {
    setError(message);
    setInvalid(field);
  };

  const submit = async (event) => {
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
        await signUpWithEmail(trimmed.toLowerCase(), password, fname.trim() || undefined);
        setSentTo(trimmed);
      } catch (err) {
        fail("email", SIGNUP_ERRORS[err.message] || err.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      await signInWithEmail(trimmed.toLowerCase(), password);
      await refresh();
      navigate("/");
    } catch (err) {
      fail("email", SIGNIN_ERRORS[err.message] || err.message);
      setBusy(false);
    }
  };

  const isSignUp = mode === "signup";

  return (
    <>
      <Helmet>
        <title>Sign in — TripTribe</title>
        <meta
          name="description"
          content="Sign in to TripTribe to reopen the trips you have already planned, or register to keep the next one."
        />
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="tt-page">
        <section className="tt-turnstile" aria-labelledby="tt-gate-title">
          <div className="tt-rail">
            <div className="tt-turnstile__spread">
              {/* ── The lobe that carries the form ─────────────────────── */}
              <div className="tt-turnstile__lobe tt-turnstile__lobe--form">
                <div className="tt-gate">
                  <div className="tt-gate__head">
                    <h1 id="tt-gate-title" className="tt-gate__title">
                      The account
                    </h1>
                    <p className="tt-gate__ref">
                      <span>TT</span>
                      <span className="tt-gate__slash">/</span>
                      <span>AUTH</span>
                    </p>
                  </div>

                  {/* Sign in and sign-up are two spans of one rule, not two
                      buttons. The disc marks the span you are standing at. */}
                  <div
                    className="tt-segment"
                    role="tablist"
                    aria-label="Sign in or register"
                    data-mode={mode}
                  >
                    <button
                      type="button"
                      role="tab"
                      id="tt-tab-signin"
                      className="tt-segment__tab"
                      aria-selected={!isSignUp}
                      aria-controls="tt-gate-panel"
                      tabIndex={isSignUp ? -1 : 0}
                      ref={(el) => {
                        tabRefs.current.signin = el;
                      }}
                      onClick={() => changeMode("signin")}
                      onKeyDown={onSegmentKeyDown}
                    >
                      Sign in
                      <span className="tt-segment__ref" aria-hidden="true">
                        01
                      </span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      id="tt-tab-signup"
                      className="tt-segment__tab"
                      aria-selected={isSignUp}
                      aria-controls="tt-gate-panel"
                      tabIndex={isSignUp ? 0 : -1}
                      ref={(el) => {
                        tabRefs.current.signup = el;
                      }}
                      onClick={() => changeMode("signup")}
                      onKeyDown={onSegmentKeyDown}
                    >
                      Register
                      <span className="tt-segment__ref" aria-hidden="true">
                        02
                      </span>
                    </button>
                    <span className="tt-segment__disc" aria-hidden="true" />
                  </div>

                  {sentTo ? (
                    <div className="tt-gate__sent">
                      <h2 className="tt-gate__sent-title">
                        Check your email for the verification link
                      </h2>
                      <p className="tt-gate__sent-body">
                        The auth service sent a verification link to
                      </p>
                      <p className="tt-gate__sent-to">{sentTo}</p>
                      <p className="tt-gate__sent-body" style={{ marginTop: "1.1rem" }}>
                        Open it to finish setting up the account, then sign in here.
                      </p>
                      <div className="tt-gate__action">
                        <button
                          type="button"
                          className="tt-btn"
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
                      id="tt-gate-panel"
                      role="tabpanel"
                      aria-labelledby={isSignUp ? "tt-tab-signup" : "tt-tab-signin"}
                      onSubmit={submit}
                      noValidate
                    >
                      <AuthProviders disabled={busy} onError={setError} />

                      <p className="tt-providers__or">or with email</p>

                      <div className="tt-rows">
                        {isSignUp && (
                          <div className="tt-row">
                            <label className="tt-row__label" htmlFor="tt-auth-name">
                              Name
                            </label>
                            <input
                              id="tt-auth-name"
                              className="tt-row__input tt-row__input--name"
                              type="text"
                              autoComplete="name"
                              placeholder="How you want to be called"
                              value={fname}
                              onChange={(e) => setFname(e.target.value)}
                            />
                          </div>
                        )}

                        <div className="tt-row">
                          <label className="tt-row__label" htmlFor="tt-auth-email">
                            Email
                          </label>
                          <input
                            id="tt-auth-email"
                            className="tt-row__input"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={email}
                            aria-invalid={invalid === "email"}
                            aria-describedby={invalid === "email" ? "tt-auth-email-error" : undefined}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                          {invalid === "email" && (
                            <p className="tt-row__error" id="tt-auth-email-error" role="alert">
                              {error}
                            </p>
                          )}
                        </div>

                        <div className="tt-row">
                          <label className="tt-row__label" htmlFor="tt-auth-password">
                            Password
                          </label>
                          <input
                            id="tt-auth-password"
                            className="tt-row__input tt-row__input--secret"
                            type="password"
                            autoComplete={isSignUp ? "new-password" : "current-password"}
                            placeholder="••••••••"
                            value={password}
                            aria-invalid={invalid === "password"}
                            aria-describedby={
                              invalid === "password" ? "tt-auth-password-error" : undefined
                            }
                            onChange={(e) => setPassword(e.target.value)}
                          />
                          {invalid === "password" && (
                            <p className="tt-row__error" id="tt-auth-password-error" role="alert">
                              {error}
                            </p>
                          )}
                        </div>

                        {isSignUp && (
                          <div className="tt-row">
                            <label className="tt-row__label" htmlFor="tt-auth-confirm">
                              Confirm password
                            </label>
                            <input
                              id="tt-auth-confirm"
                              className="tt-row__input tt-row__input--secret"
                              type="password"
                              autoComplete="new-password"
                              placeholder="••••••••"
                              value={confirm}
                              aria-invalid={invalid === "confirm"}
                              aria-describedby={
                                invalid === "confirm" ? "tt-auth-confirm-error" : undefined
                              }
                              onChange={(e) => setConfirm(e.target.value)}
                            />
                            {invalid === "confirm" && (
                              <p
                                className="tt-row__error"
                                id="tt-auth-confirm-error"
                                role="alert"
                              >
                                {error}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* An error with no single field to name — a provider
                          failure, or a sheet-level rejection — lands under the
                          whole ledger, hinged at the rule like an errata slip. */}
                      {error && !invalid && (
                        <p className="tt-row__error tt-row__error--sheet" role="alert">
                          {error}
                        </p>
                      )}

                      <div className="tt-gate__action">
                        <button type="submit" className="tt-btn" disabled={busy}>
                          {isSignUp ? "Register" : "Continue"}
                          <IconArrow />
                        </button>
                        <p className="tt-gate__need">
                          {isSignUp
                            ? "A name is optional. The email and password are not."
                            : "Use the same email and password you registered with."}
                        </p>
                      </div>
                    </form>
                  )}

                  <button
                    type="button"
                    className="tt-turnstile__back"
                    onClick={() => navigate("/")}
                  >
                    <IconBack />
                    Back to the route
                  </button>
                </div>
              </div>

              {/* ── The cut ────────────────────────────────────────────── */}
              <div className="tt-turnstile__coast">
                <Coastline />
              </div>

              {/* ── The margin: what an account holds ──────────────────── */}
              <div className="tt-turnstile__lobe tt-turnstile__lobe--margin">
                <aside className="tt-margin">
                  <h2 className="tt-margin__title">What the account holds</h2>
                  <p className="tt-margin__body">
                    Planning a trip works signed out. An account is what makes the plan
                    yours afterwards — reachable on any device, and still there when the
                    group asks.
                  </p>

                  <ul className="tt-margin__list">
                    {HOLDS.map(({ Icon, name, body }) => (
                      <li className="tt-margin__item" key={name}>
                        <span className="tt-margin__icon">
                          <Icon />
                        </span>
                        <div>
                          <h3 className="tt-margin__name">{name}</h3>
                          <p className="tt-margin__text">{body}</p>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <p className="tt-margin__fine">
                    Credentials are handled by the shared auth service at
                    auth.shrijit.tech. TripTribe keeps no password of its own.
                  </p>
                </aside>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default Auth;