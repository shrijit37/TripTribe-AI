"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchTrips } from "@/lib/api";
import { storeTripPlan } from "@/lib/nav";
import type { TripsApiRecord } from "@/lib/types";
import { useAuth } from "@/context/AuthProvider";
import "../mx-auth.css";

type DrawerStatus = "loading" | "ready" | "error";

interface AccountDrawerProps {
  open: boolean;
  onClose: () => void;
  name: string;
  email: string;
}

const relativeDay = (value?: string) => {
  if (!value) return "";
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return "";
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

const AccountDrawer = ({ open, onClose, name, email }: AccountDrawerProps) => {
  const router = useRouter();
  const { logout } = useAuth();
  const [trips, setTrips] = useState<TripsApiRecord[]>([]);
  const [status, setStatus] = useState<DrawerStatus>("loading");
  const panelRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement;
    let tries = 0;
    const focusWhenVisible = () => {
      const panel = panelRef.current;
      if (panel && getComputedStyle(panel).visibility === "visible") {
        closeRef.current?.focus();
        return;
      }
      if (tries++ < 40) requestAnimationFrame(focusWhenVisible);
    };
    focusWhenVisible();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const stops = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null
      );
      if (!stops.length) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [open]);

  const loadTrips = useCallback(async () => {
    setStatus("loading");
    const data = await fetchTrips();
    if (data === null) {
      setTrips([]);
      setStatus("error");
      return;
    }
    setTrips(data);
    setStatus("ready");
  }, []);

  useEffect(() => {
    if (open) loadTrips();
  }, [open, loadTrips]);

  const openTrip = (trip: TripsApiRecord) => {
    if (!trip.itenary) return;
    storeTripPlan(trip.itenary);
    router.push("/result");
    onClose();
  };

  const signOut = async () => {
    await logout();
    onClose();
    router.push("/");
  };

  return (
    <>
      <button
        type="button"
        className="mx-au-scrim"
        data-open={open}
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />

      <aside
        className="mx-au-drawer"
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-label="Your account"
        ref={panelRef}
      >
        <div className="mx-au-drawerhead">
          <div className="mx-au-id">
            <span className="mx-au-initial" aria-hidden="true">
              {(name || "?").slice(0, 1)}
            </span>
            <div style={{ minWidth: 0 }}>
              <p className="mx-au-name">{name}</p>
              <p className="mx-au-email">{email}</p>
            </div>
          </div>
          <button
            type="button"
            className="mx-au-close"
            onClick={onClose}
            ref={closeRef}
            aria-label="Close the account panel"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 18 18 6M6 6l12 12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="mx-au-drawerbody" role="status" aria-live="polite">
          <h2 className="mx-au-head2" style={{ marginTop: 0 }}>
            Recent trips
          </h2>

          {status === "loading" && (
            <p className="mx-au-note">Loading your trips…</p>
          )}

          {status === "error" && (
            <>
              <p className="mx-au-note">
                Trips could not be loaded — the itinerary service did not answer. Try
                again, or plan a trip and it will be here.
              </p>
              <div className="mx-au-actions">
                <button type="button" className="mx-au-btn" onClick={loadTrips}>
                  Try again
                </button>
              </div>
            </>
          )}

          {status === "ready" && trips.length === 0 && (
            <p className="mx-au-note">
              No trips yet. Plan one and it will be listed here — that is what the account
              is for.
            </p>
          )}

          {status === "ready" && trips.length > 0 && (
            <>
              <ul className="mx-au-trips">
                {trips.map((trip, index) => (
                  <li className="mx-au-tripitem" key={trip.uuid || index}>
                    <button type="button" className="mx-au-trip" onClick={() => openTrip(trip)}>
                      <span className="mx-au-tripcity">{trip.cityName}</span>
                      <span className="mx-au-tripwhen">{relativeDay(trip.time)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mx-au-fine">
                Prices and availability in a saved plan are estimates.
              </p>
            </>
          )}
        </div>

        <div className="mx-au-drawerfoot">
          <button
            type="button"
            className="mx-au-footlink"
            onClick={() => {
              onClose();
              router.push("/account");
            }}
          >
            Manage account
          </button>
          <button type="button" className="mx-au-footlink" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
};

export default AccountDrawer;
