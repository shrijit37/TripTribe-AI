"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Coastline from "@/components/Coastline";
import { useAuth } from "@/context/AuthProvider";
import {
  changePassword,
  deleteAuthUser,
  updateAuthUser,
} from "@/lib/auth-client";
import { deleteProfile, fetchProfile, updateProfile } from "@/lib/api";
import type { UserProfile } from "@/lib/types";

/**
 * `/account` — profile, password, and delete.
 * The drawer keeps the trips ledger; this page owns everything else the
 * legacy `PUT /profile` accepted (`fname`, `lname`, `userInterest`,
 * `userAddress`), in the same turnstile grammar as `/auth`. Identity
 * (`authId`, `email`) is read-only: it comes from the session cookie.
 */
export default function Account() {
  const router = useRouter();
  const { user, loading, logout, refresh } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [interests, setInterests] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwNote, setPwNote] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const [armed, setArmed] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [delNote, setDelNote] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user) return;
    let live = true;
    (async () => {
      const data = await fetchProfile();
      if (!live) return;
      if (!data) {
        setStatus("error");
        return;
      }
      setProfile(data);
      setFname(data.fname);
      setLname(data.lname);
      setInterests((data.userInterest ?? []).join(", "));
      setAddress(data.userAddress ?? "");
      setStatus("ready");
    })();
    return () => {
      live = false;
    };
  }, [loading, user]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNote("");
    if (!fname.trim()) {
      setNote("Enter how you want to be called.");
      return;
    }
    setSaving(true);
    try {
      const interestList = interests
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const result = await updateProfile({
        fname: fname.trim(),
        lname: lname.trim(),
        userInterest: interestList,
        userAddress: address.trim(),
      });
      if (!result.ok || !result.profile) {
        setNote(result.message);
        return;
      }
      setProfile(result.profile);
      const displayName = [fname.trim(), lname.trim()].filter(Boolean).join(" ");
      try {
        await updateAuthUser(displayName);
      } catch {
        // Local profile is the record that matters; the auth-service name is
        // a display copy. A failure here must not present the save as failed.
      }
      await refresh();
      setNote("Saved.");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPwNote("");
    if (!current) {
      setPwNote("Enter your current password.");
      return;
    }
    if (next.length < 8) {
      setPwNote("Use at least 8 characters for the new password.");
      return;
    }
    if (next !== confirm) {
      setPwNote("The two passwords don't match. Retype them.");
      return;
    }
    setPwBusy(true);
    try {
      await changePassword(next, current);
      setCurrent("");
      setNext("");
      setConfirm("");
      setPwNote("Password changed. Other devices were signed out.");
    } catch (err) {
      setPwNote(err instanceof Error ? err.message : "Could not change that password.");
    } finally {
      setPwBusy(false);
    }
  };

  const destroy = async () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setDelBusy(true);
    setDelNote("");
    try {
      await deleteAuthUser();
      const ok = await deleteProfile();
      if (!ok) {
        setDelNote("Could not delete your account right now.");
        return;
      }
      await logout();
      router.push("/");
    } finally {
      setDelBusy(false);
    }
  };

  if (loading || (!user && status === "loading")) {
    return (
      <main className="tt-page">
        <p className="tt-gate__need" role="status">
          Loading your account…
        </p>
      </main>
    );
  }

  return (
    <main className="tt-page">
      <section className="tt-turnstile" aria-labelledby="tt-account-title">
        <div className="tt-rail">
          <div className="tt-turnstile__spread">
            <div className="tt-turnstile__lobe tt-turnstile__lobe--form">
              <div className="tt-gate">
                <div className="tt-gate__head">
                  <h1 id="tt-account-title" className="tt-gate__title">
                    Your account
                  </h1>
                  <p className="tt-gate__ref">
                    <span>TT</span>
                    <span className="tt-gate__slash">/</span>
                    <span>ACCOUNT</span>
                  </p>
                </div>

                {status === "loading" && (
                  <p className="tt-gate__need" role="status">
                    Loading your profile…
                  </p>
                )}

                {status === "error" && (
                  <>
                    <p className="tt-row__error tt-row__error--sheet" role="alert">
                      Your profile could not be loaded — the service did not answer.
                    </p>
                    <div className="tt-gate__action">
                      <button
                        type="button"
                        className="tt-btn"
                        onClick={() => window.location.reload()}
                      >
                        Try again
                      </button>
                    </div>
                  </>
                )}

                {status === "ready" && profile && (
                  <>
                    <p className="tt-gate__need">
                      Signed in as {profile.email} — the address your trips are filed
                      under. It cannot be changed here.
                    </p>

                    <form onSubmit={save} noValidate>
                      <div className="tt-rows">
                        <div className="tt-row">
                          <label className="tt-row__label" htmlFor="tt-acct-fname">
                            Name
                          </label>
                          <input
                            id="tt-acct-fname"
                            className="tt-row__input tt-row__input--name"
                            type="text"
                            autoComplete="given-name"
                            value={fname}
                            onChange={(e) => setFname(e.target.value)}
                          />
                        </div>
                        <div className="tt-row">
                          <label className="tt-row__label" htmlFor="tt-acct-lname">
                            Last name
                          </label>
                          <input
                            id="tt-acct-lname"
                            className="tt-row__input"
                            type="text"
                            autoComplete="family-name"
                            placeholder="Optional"
                            value={lname}
                            onChange={(e) => setLname(e.target.value)}
                          />
                        </div>
                        <div className="tt-row">
                          <label className="tt-row__label" htmlFor="tt-acct-interests">
                            Interests
                          </label>
                          <input
                            id="tt-acct-interests"
                            className="tt-row__input"
                            type="text"
                            placeholder="Temples, street food, viewpoints"
                            value={interests}
                            onChange={(e) => setInterests(e.target.value)}
                          />
                        </div>
                        <div className="tt-row">
                          <label className="tt-row__label" htmlFor="tt-acct-address">
                            Address
                          </label>
                          <input
                            id="tt-acct-address"
                            className="tt-row__input"
                            type="text"
                            autoComplete="street-address"
                            placeholder="Where plans reach you"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                          />
                        </div>
                      </div>
                      {note && (
                        <p className="tt-gate__need" role="status">
                          {note}
                        </p>
                      )}
                      <div className="tt-gate__action">
                        <button type="submit" className="tt-btn" disabled={saving}>
                          {saving ? "Saving…" : "Save profile"}
                        </button>
                        <p className="tt-gate__need">
                          Interests are comma-separated, up to 20. They shape nothing yet —
                          they are kept for the planner to use.
                        </p>
                      </div>
                    </form>

                    <form onSubmit={savePassword} noValidate>
                      <h2 className="tt-margin__name" style={{ marginTop: "2rem" }}>
                        Password
                      </h2>
                      <div className="tt-rows">
                        <div className="tt-row">
                          <label className="tt-row__label" htmlFor="tt-acct-current">
                            Current password
                          </label>
                          <input
                            id="tt-acct-current"
                            className="tt-row__input tt-row__input--secret"
                            type="password"
                            autoComplete="current-password"
                            value={current}
                            onChange={(e) => setCurrent(e.target.value)}
                          />
                        </div>
                        <div className="tt-row">
                          <label className="tt-row__label" htmlFor="tt-acct-next">
                            New password
                          </label>
                          <input
                            id="tt-acct-next"
                            className="tt-row__input tt-row__input--secret"
                            type="password"
                            autoComplete="new-password"
                            value={next}
                            onChange={(e) => setNext(e.target.value)}
                          />
                        </div>
                        <div className="tt-row">
                          <label className="tt-row__label" htmlFor="tt-acct-confirm">
                            Confirm new password
                          </label>
                          <input
                            id="tt-acct-confirm"
                            className="tt-row__input tt-row__input--secret"
                            type="password"
                            autoComplete="new-password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                          />
                        </div>
                      </div>
                      {pwNote && (
                        <p className="tt-gate__need" role="status">
                          {pwNote}
                        </p>
                      )}
                      <div className="tt-gate__action">
                        <button type="submit" className="tt-btn" disabled={pwBusy}>
                          {pwBusy ? "Changing…" : "Change password"}
                        </button>
                      </div>
                    </form>

                    <h2 className="tt-margin__name" style={{ marginTop: "2rem" }}>
                      Delete account
                    </h2>
                    <p className="tt-gate__need">
                      Removes your profile and every trip filed under it. This cannot be
                      undone.
                    </p>
                    {delNote && (
                      <p className="tt-row__error tt-row__error--sheet" role="alert">
                        {delNote}
                      </p>
                    )}
                    <div className="tt-gate__action">
                      <button
                        type="button"
                        className="tt-btn"
                        disabled={delBusy}
                        onClick={destroy}
                      >
                        {delBusy ? "Deleting…" : armed ? "Confirm delete" : "Delete account"}
                      </button>
                      {armed && !delBusy && (
                        <p className="tt-gate__need">
                          One more click deletes everything.{" "}
                          <button
                            type="button"
                            className="tt-nav__link tt-nav__link--quiet"
                            onClick={() => setArmed(false)}
                          >
                            Keep my account
                          </button>
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="tt-turnstile__coast">
              <Coastline />
            </div>

            <div className="tt-turnstile__lobe tt-turnstile__lobe--margin">
              <aside className="tt-margin">
                <h2 className="tt-margin__title">What lives here</h2>
                <p className="tt-margin__body">
                  The name the group sees, the interests the planner will use, and the
                  address trips are filed under. Trips themselves stay in the account
                  drawer — this page never moves a plan.
                </p>
                <p className="tt-margin__fine">
                  Credentials live on the shared auth service. Changing the password
                  signs out every other device.
                </p>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
