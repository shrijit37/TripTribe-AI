"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AccountDrawer from "@/components/AccountDrawer";
import { useAppSelector } from "@/store";

/**
 * The supplement's running head. `Sign in` routes to `/auth`; the account drawer
 * replaces the daisyUI drawer that used to hang off an avatar here.
 */
const Navbar = () => {
  const router = useRouter();
  const [accountOpen, setAccountOpen] = useState(false);
  const userInfo = useAppSelector((s) => s.auth.userInfo);

  const openAccount = () => setAccountOpen(true);

  return (
    <>
      <nav className="tt-nav">
        <button
          type="button"
          className="tt-nav__mark"
          onClick={() => router.push("/")}
          aria-label="TripTribe, home"
        >
          <span className="tt-nav__wordmark">TripTribe</span>
          <span className="tt-nav__ref" aria-hidden="true">
            TT/ROUTE
          </span>
        </button>

        <div className="tt-nav__actions">
          <button
            type="button"
            className="tt-nav__link"
            onClick={() => router.push("/search")}
          >
            Plan a trip
          </button>

          {userInfo ? (
            <button
              type="button"
              className="tt-nav__link tt-nav__link--quiet"
              onClick={openAccount}
              aria-haspopup="dialog"
            >
              Account
            </button>
          ) : (
            <button
              type="button"
              className="tt-nav__link tt-nav__link--quiet"
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
