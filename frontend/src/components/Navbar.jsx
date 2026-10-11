import { useNavigate } from "react-router";
import { useState } from "react";
import AccountDrawer from "./AccountDrawer";
import { useSelector } from "react-redux";

/**
 * The supplement's running head. `Sign in` routes to `/auth`; the account drawer
 * replaces the daisyUI drawer that used to hang off an avatar here.
 */
const Navbar = () => {
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const { userInfo } = useSelector((state) => state.auth);

  const openAccount = () => setAccountOpen(true);

  return (
    <>
      <nav className="tt-nav">
        <button
          type="button"
          className="tt-nav__mark"
          onClick={() => navigate("/")}
          aria-label="TripTribe, home"
        >
          <span className="tt-nav__wordmark">TripTribe</span>
          <span className="tt-nav__ref" aria-hidden="true">
            TT/ROUTE
          </span>
        </button>

        <div className="tt-nav__actions">
          <button type="button" className="tt-nav__link" onClick={() => navigate("/search")}>
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
              onClick={() => navigate("/auth")}
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