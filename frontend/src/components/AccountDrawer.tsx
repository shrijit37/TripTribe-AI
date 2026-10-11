"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchTrips } from "@/lib/api";
import { storeTripPlan } from "@/lib/nav";
import type { TripsApiRecord } from "@/lib/types";
import { useAuth } from "@/context/AuthProvider";

/**
 * The account drawer — pressed stock, one hairline edge, no overlay blur.
 *
 * Trips come from `GET /api/itenary/all`, which is authenticated and returns the
 * itineraries this user has generated. Before this the drawer read
 * `state.auth.userInfo.recentSearch`, a field the shared auth session never
 * populates, so it always rendered empty.
 *
 * States it owns: closed, open, loading, trips, and the two failures that matter —
 * no trips yet, and the API unreachable. The API never renders as an empty list,
 * because those two mean different things to someone looking for their plan.
 */

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

  // Navbar passes a fresh arrow on every render. Held in a ref so the focus
  // effect below keys on `open` alone — otherwise it tore down and re-ran on
  // every state change, and its cleanup kept yanking focus back to the opener
  // the moment the trips fetch landed. The drawer never took focus at all.
  const onCloseRef = useRef(onClose);

  // Synced in an effect rather than assigned during render: writing to a ref
  // mid-render is a side effect React cannot order against a concurrent render.
  // Declared above the focus effect because effects run in declaration order,
  // so the focus effect always sees the current `onClose` — which is the whole
  // reason the ref exists (Navbar passes a fresh arrow every render, and keying
  // the focus effect on it tore the drawer down on every state change, yanking
  // focus back to the opener the moment the trips fetch landed).
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    // Focus in, and remember where focus came from so it can go back. Without
    // this, Escape dropped a keyboard user at the top of the page behind the
    // drawer rather than on the control that opened it.
    const opener = document.activeElement;
    // The panel is `visibility: hidden` while its slide-in runs, and a hidden
    // element refuses focus — so focusing on the opening frame was silently
    // dropped and the drawer never took focus at all. Measured: hidden at 14ms,
    // visible from ~31ms, i.e. one frame later but not reliably one. Poll the
    // actual condition instead of guessing a frame count.
    //
    // `focus()` returns undefined, so the success test cannot be its return
    // value — doing that made every iteration look like a miss and the loop ran
    // all 40 frames. Test the panel's visibility alone and focus unconditionally.
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
      // A modal claims Tab. Without this, Tab walked straight out of the panel
      // into the page still visible behind it.
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
    // `null` means the API failed to answer at all; `[]` means it answered with
    // nothing. Those are different answers to "where are my plans?", so they are
    // kept apart rather than collapsed into one empty ledger.
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
        className="tt-account__scrim"
        data-open={open}
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />

      <aside
        className="tt-account"
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-label="Your account"
        ref={panelRef}
      >
        <div className="tt-account__head">
          <div className="tt-account__id">
            <span className="tt-account__initial" aria-hidden="true">
              {(name || "?").slice(0, 1)}
            </span>
            <div style={{ minWidth: 0 }}>
              <p className="tt-account__name">{name}</p>
              <p className="tt-account__email">{email}</p>
            </div>
          </div>
          <button
            type="button"
            className="tt-account__close"
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

        {/* The async body is one live region. Loading, empty, failure and the
            trips ledger all resolve after the panel opens, and without this a
            screen-reader user was told nothing when the fetch landed. */}
        <div className="tt-account__body" role="status" aria-live="polite">
          <p className="tt-account__ref">
            <span>TT</span>
            <span className="tt-account__slash">/</span>
            <span>ROUTES</span>
          </p>
          <h2 className="tt-account__head2">Recent trips</h2>

          {status === "loading" && (
            <p className="tt-trips__empty">Loading your trips…</p>
          )}

          {status === "error" && (
            <>
              <p className="tt-trips__empty">
                Trips could not be loaded — the itinerary service did not answer. Try again,
                or plan a trip and it will be here.
              </p>
              <div className="tt-gate__action">
                <button type="button" className="tt-btn" onClick={loadTrips}>
                  Try again
                </button>
              </div>
            </>
          )}

          {status === "ready" && trips.length === 0 && (
            <p className="tt-trips__empty">
              No trips yet. Plan one and it will be listed here — that is what the account
              is for.
            </p>
          )}

          {status === "ready" && trips.length > 0 && (
            <>
              <ul className="tt-trips">
                {trips.map((trip, index) => (
                  <li key={trip._id || index}>
                    <button type="button" className="tt-trip" onClick={() => openTrip(trip)}>
                      <span className="tt-trip__city">{trip.cityName}</span>
                      <span className="tt-trip__when">{relativeDay(trip.createdAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="tt-trips__note">
                Prices and availability in a saved plan are estimates.
              </p>
            </>
          )}
        </div>

        <div className="tt-account__foot">
          <button type="button" className="tt-nav__link tt-nav__link--quiet" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
};

export default AccountDrawer;