"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AccountDrawer from "@/components/AccountDrawer";
import { useAppSelector } from "@/store";

/**
 * The neutral running head: a serif wordmark in dark ink, mono route ref,
 * and two standing actions. Deliberately neither cover nor diary — it
 * bridges both. `Sign in` routes to `/auth`; the account drawer opens over
 * the page for signed-in travellers.
 */
const Navbar = () => {
  const router = useRouter();
  const [accountOpen, setAccountOpen] = useState(false);
  const userInfo = useAppSelector((s) => s.auth.userInfo);

  return (
    <>
      <nav className="mx-strip" aria-label="TripTribe">
        <button
          type="button"
          className="mx-strip__mark"
          onClick={() => router.push("/")}
          aria-label="TripTribe, home"
        >
          <span className="mx-strip__wordmark">TripTribe</span>
          <span className="mx-strip__ref" aria-hidden="true">
            TT/ROUTE
          </span>
        </button>

        <div className="mx-strip__actions">
          <button
            type="button"
            className="mx-strip__btn"
            onClick={() => router.push("/plan")}
          >
            Plan a trip
          </button>

          {userInfo ? (
            <button
              type="button"
              className="mx-strip__btn mx-strip__btn--quiet"
              onClick={() => setAccountOpen(true)}
              aria-haspopup="dialog"
            >
              Account
            </button>
          ) : (
            <button
              type="button"
              className="mx-strip__btn mx-strip__btn--quiet"
              onClick={() => router.push("/auth")}
            >
              Sign in
            </button>
          )}
        </div>
      </nav>

      {userInfo && (
        <AccountDrawer
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
          name={userInfo.fname || userInfo.email}
          email={userInfo.email}
        />
      )}
    </>
  );
};

export default Navbar;
