import { useNavigate } from "react-router";
import { useState } from "react";
import Signin from "./Signin";
import Signup from "./Signup";
import { useDispatch, useSelector } from "react-redux";
import { logOut } from "../../Redux/auth/authSlice";
import { useLogoutMutation } from "../../Redux/api/userApiSlice";

const Navbar = () => {
  const date = new Date();
  let navigate = useNavigate();
  const [logout] = useLogoutMutation();


  const [signin, setSignin] = useState(true);
  const userInfo = useSelector((state) => state.auth);

  const dispatch = useDispatch();

  const data = userInfo.userInfo;

  const logoutHandler = async (e) => {
    e.preventDefault();
    try {
      dispatch(logOut());
      await logout().unwrap();
      localStorage.removeItem("userInfo");
      localStorage.removeItem("expirationTime");
      navigate("/");
    } catch (error) {
      console.log(error);
    }
  };


  const recentHandler =  (item) => {
    if(item) {
      const iten = item.itenary;
      navigate("/result", {state: iten})
    } else {
      console.log("cant find the itenary.");
    }
  }
  return (
    <>
      <nav className="flex justify-between items-center lg:w-[92%] w-[100vh] mx-auto my-4 px-2">
        <div className="">
          <div
            className="text-5xl font-poppin cursor-pointer"
            onClick={() => {
              navigate("/");
            }}
          >
            TripTribe
          </div>
        </div>
        <div className="flex justify-between ">
          <button
            className="btn btn-primary mx-5"
            onClick={() => navigate("/search")}
          >
            Try it! 💫
          </button>
          {userInfo.userInfo ? (
            <>
              <div className="drawer drawer-end z-50">
                <input
                  id="my-drawer-4"
                  type="checkbox"
                  className="drawer-toggle"
                />

                <div className="avatar avatar-placeholder">
                  <label
                    className="bg-neutral text-neutral-content w-12 rounded-full content-center text-center drawer-content"
                    htmlFor="my-drawer-4"
                  >
                    <span>
                      {userInfo.userInfo.fname[0]}
                    </span>
                  </label>
                </div>
                <div className="drawer-side">
                  <label
                    htmlFor="my-drawer-4"
                    aria-label="close sidebar"
                    className="drawer-overlay"
                  ></label>
                  <ul className="menu bg-base-200 text-base-content min-h-full w-80 p-4">
                    <div className="avatar avatar-placeholder content-center text-center justify-center my-5">
                      <div className="bg-neutral text-neutral-content w-24 rounded-full content-center text-center">
                        <span className="text-3xl">
                          {userInfo.userInfo.fname[0]}                        </span>
                      </div>
                    </div>
                    {/* to be done after doing recent search and saved itenary backend*/}
                    <div className="flex justify-center flex-col text-center content-center items-center">
                      <div className="text-3xl justify-center">
                        {userInfo.userInfo.fname}
                      </div>
                      <div
                        className="badge badge-outline badge-error justify-center mt-1 btn h-2"
                        onClick={logoutHandler}
                      >
                        Sign-out
                      </div>
                    </div>
                    <br />
                    <hr />
                    <div className="text-xl text-center mt-3">
                      Recent Search
                    </div>

                    <ul className="list">

                      <div className="list-col-grow space-y-2 font-medium">
                        {
                          data && data.recentSearch && data.recentSearch.map((item, idx) => {
                            return (
                              <li className="list-row" key={idx}>
                                <div onClick={() => recentHandler(item)}>
                                  <div>{item.city[0].toUpperCase() + item.city.slice(1)}</div>
                                  <span className="inline text-green-300">{Math.floor((date - new Date(item.createdAt)) / (1000 * 60 * 60 * 24)) ? Math.floor((date - new Date(item.createdAt)) / (1000 * 60 * 60 * 24)) + " days ago" : "today"}</span>
                                </div>

                              </li>
                            )
                          })
                        }

                      </div>
                    </ul>
                    <br />
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <button
              className="btn"
              onClick={() => document.getElementById("my_modal_4").showModal()}
            >
              Sign-in
            </button>
          )}
          <dialog id="my_modal_4" className="modal">
            <div className="modal-box w-11/12 sm:w-3/4 md:w-1/2 lg:w-1/3 xl:w-1/4 max-w-5xl">
              <div className="modal-action justify-end">
                <form method="dialog">
                  <button className="btn btn-square">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </form>
              </div>

              {signin ? (
                <Signin setSignin={setSignin} />
              ) : (
                <Signup setSignin={setSignin} />
              )}
            </div>
          </dialog>

        </div>
      </nav>
    </>
  );
};

export default Navbar;
