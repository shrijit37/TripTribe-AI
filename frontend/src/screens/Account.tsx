"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import {
  changePassword,
  deleteAuthUser,
  updateAuthUser,
} from "@/lib/auth-client";
import { deleteProfile, fetchProfile, updateProfile } from "@/lib/api";
import type { UserProfile } from "@/lib/types";
import "../mx-auth.css";

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
      <main className="mx-au-page">
        <p className="mx-au-note" role="status">
          Loading your account…
        </p>
      </main>
    );
  }

  return (
    <main className="mx-au-page">
      <div className="mx-au-grid">
        <section className="mx-au-sheet" aria-labelledby="mx-au-account-title">
          <h1 id="mx-au-account-title" className="mx-au-title">
            Your account
          </h1>

          {status === "loading" && (
            <p className="mx-au-note" role="status">
              Loading your profile…
            </p>
          )}

          {status === "error" && (
            <>
              <p className="mx-au-error" role="alert">
                Your profile could not be loaded — the service did not answer.
              </p>
              <div className="mx-au-actions">
                <button
                  type="button"
                  className="mx-au-btn"
                  onClick={() => window.location.reload()}
                >
                  Try again
                </button>
              </div>
            </>
          )}

          {status === "ready" && profile && (
            <>
              <p className="mx-au-hint">
                Signed in as {profile.email} — the address your trips are filed under. It
                cannot be changed here.
              </p>

              <form onSubmit={save} noValidate>
                <div className="mx-au-rows">
                  <div className="mx-au-row">
                    <label htmlFor="mx-au-acct-fname">Name</label>
                    <input
                      id="mx-au-acct-fname"
                      type="text"
                      autoComplete="given-name"
                      value={fname}
                      onChange={(e) => setFname(e.target.value)}
                    />
                  </div>
                  <div className="mx-au-row">
                    <label htmlFor="mx-au-acct-lname">Last name</label>
                    <input
                      id="mx-au-acct-lname"
                      type="text"
                      autoComplete="family-name"
                      placeholder="Optional"
                      value={lname}
                      onChange={(e) => setLname(e.target.value)}
                    />
                  </div>
                  <div className="mx-au-row">
                    <label htmlFor="mx-au-acct-interests">Interests</label>
                    <input
                      id="mx-au-acct-interests"
                      type="text"
                      placeholder="Temples, street food, viewpoints"
                      value={interests}
                      onChange={(e) => setInterests(e.target.value)}
                    />
                  </div>
                  <div className="mx-au-row">
                    <label htmlFor="mx-au-acct-address">Address</label>
                    <input
                      id="mx-au-acct-address"
                      type="text"
                      autoComplete="street-address"
                      placeholder="Where plans reach you"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>
                {note && (
                  <p className="mx-au-note" role="status">
                    {note}
                  </p>
                )}
                <div className="mx-au-actions">
                  <button type="submit" className="mx-au-btn" disabled={saving}>
                    {saving ? "Saving…" : "Save profile"}
                  </button>
                  <p className="mx-au-note">
                    Interests are comma-separated, up to 20. They shape nothing yet — they
                    are kept for the planner to use.
                  </p>
                </div>
              </form>

              <hr className="mx-au-rule" />

              <form onSubmit={savePassword} noValidate>
                <h2 className="mx-au-head2">Password</h2>
                <div className="mx-au-rows">
                  <div className="mx-au-row">
                    <label htmlFor="mx-au-acct-current">Current password</label>
                    <input
                      id="mx-au-acct-current"
                      className="mx-au-secret"
                      type="password"
                      autoComplete="current-password"
                      value={current}
                      onChange={(e) => setCurrent(e.target.value)}
                    />
                  </div>
                  <div className="mx-au-row">
                    <label htmlFor="mx-au-acct-next">New password</label>
                    <input
                      id="mx-au-acct-next"
                      className="mx-au-secret"
                      type="password"
                      autoComplete="new-password"
                      value={next}
                      onChange={(e) => setNext(e.target.value)}
                    />
                  </div>
                  <div className="mx-au-row">
                    <label htmlFor="mx-au-acct-confirm">Confirm new password</label>
                    <input
                      id="mx-au-acct-confirm"
                      className="mx-au-secret"
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </div>
                </div>
                {pwNote && (
                  <p className="mx-au-note" role="status">
                    {pwNote}
                  </p>
                )}
                <div className="mx-au-actions">
                  <button type="submit" className="mx-au-btn" disabled={pwBusy}>
                    {pwBusy ? "Changing…" : "Change password"}
                  </button>
                </div>
              </form>

              <hr className="mx-au-rule" />

              <h2 className="mx-au-head2">Delete account</h2>
              <p className="mx-au-hint">
                Removes your profile and every trip filed under it. This cannot be undone.
              </p>
              {delNote && (
                <p className="mx-au-error" role="alert">
                  {delNote}
                </p>
              )}
              <div className="mx-au-actions">
                <button
                  type="button"
                  className={armed ? "mx-au-btn mx-au-btn--danger-armed" : "mx-au-btn mx-au-btn--danger"}
                  disabled={delBusy}
                  onClick={destroy}
                >
                  {delBusy ? "Deleting…" : armed ? "Confirm delete" : "Delete account"}
                </button>
                {armed && !delBusy && (
                  <p className="mx-au-note">
                    One more click deletes everything.{" "}
                    <button
                      type="button"
                      className="mx-au-footlink"
                      onClick={() => setArmed(false)}
                    >
                      Keep my account
                    </button>
                  </p>
                )}
              </div>
            </>
          )}
        </section>

        <aside className="mx-au-margin" aria-label="What lives here">
          <h2 className="mx-au-head2" style={{ marginTop: 0 }}>
            What lives here
          </h2>
          <p className="mx-au-hint">
            The name the group sees, the interests the planner will use, and the address
            trips are filed under. Trips themselves stay in the account drawer — this page
            never moves a plan.
          </p>
          <p className="mx-au-fine">
            Credentials live on the shared auth service. Changing the password signs out
            every other device.
          </p>
        </aside>
      </div>
    </main>
  );
}
