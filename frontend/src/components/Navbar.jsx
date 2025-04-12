import { useNavigate } from "react-router"
import { useState } from "react";
import Signin from "./Signin";
import Signup from "./Signup";
import { useDispatch, useSelector } from "react-redux";
import { logOut } from "../../Redux/auth/authSlice";
const Navbar = () => {
    let navigate = useNavigate();
    const [signin, setSignin] = useState(true);
    const userInfo = useSelector((state) => state.auth);
    if (userInfo.userInfo){
        console.log(userInfo.userInfo)
    }
    const dispatch = useDispatch();

    const logoutHandler = async (e) => {
        e.preventDefault(); 
        try {
            dispatch(logOut());
            localStorage.removeItem('userInfo');
            localStorage.removeItem('expirationTime');
            navigate("/");
        } catch (error) {
            console.log(error);
        }
    }

    
    return (
        <>
            <nav className="flex justify-between items-center w-[92%] mx-auto my-4">
                <div className="">
                    <div className="text-5xl font-poppin cursor-pointer" onClick={() => { navigate("/") }}>TripTribe</div>
                </div>
                <div className="flex justify-between">
                    <button className="btn btn-primary mx-5" onClick={() => navigate("/search")}>Try it! 💫</button>
                    {
                        userInfo.userInfo ? (
                            <>

                                <div className="drawer drawer-end z-50">
                                    <input id="my-drawer-4" type="checkbox" className="drawer-toggle" />


                                    <div className="avatar avatar-placeholder">
                                        <label className="bg-neutral text-neutral-content w-12 rounded-full content-center text-center drawer-content" htmlFor="my-drawer-4">
                                            <span>{userInfo.userInfo.fname[0] + userInfo.userInfo.lname[0]}</span>
                                        </label>
                                    </div>
                                    <div className="drawer-side">
                                        <label htmlFor="my-drawer-4" aria-label="close sidebar" className="drawer-overlay"></label>
                                        <ul className="menu bg-base-200 text-base-content min-h-full w-80 p-4">
                                            <div className="avatar avatar-placeholder content-center text-center justify-center my-5">
                                                <div className="bg-neutral text-neutral-content w-24 rounded-full content-center text-center">
                                                    <span className="text-3xl">{userInfo.userInfo.fname[0] + userInfo.userInfo.lname[0]}</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-center flex-col text-center content-center items-center">
                                                <div className="text-3xl justify-center">{userInfo.userInfo.fname + " " + userInfo.userInfo.lname} </div>
                                                <div className="badge badge-outline badge-error justify-center mt-1 btn h-2" onClick={logoutHandler}>Sign-out</div>
                                            </div>
                                            <br />
                                            <div className="text-xl my-5 text-gray-400">Saved Itenaries</div>

                                            {/* to be done after doing recent search and saved itenary backend*/}
                                            <ul className="list">
                                                <li className="list-row">
                                                    <div className="list-col-grow">
                                                        <div>Manali</div>
                                                        <div className="text-xs uppercase font-semibold opacity-60">2 days ago</div>
                                                    </div>
                                                </li>
                                            </ul>

                                            <div className="mt-2">

                                                <div className="text-xl my-5 text-gray-400">Recent Search</div>

                                                {/* to be done after doing recent search and saved itenary backend*/}
                                                <ul className="list">
                                                    <li className="list-row">
                                                        <div className="list-col-grow">
                                                            <div>Manali</div>
                                                            <div className="text-xs uppercase font-semibold opacity-60">2 days ago</div>
                                                        </div>
                                                    </li>
                                                </ul>
                                            </div>
                                        </ul>
                                    </div>
                                </div>


                            </>
                        ) :
                            <button className="btn" onClick={() => document.getElementById('my_modal_4').showModal()}>Sign-in</button>

                    }
                    <dialog id="my_modal_4" className="modal">
                        <div className="modal-box w-3/12 max-w-5xl">
                            <div className="modal-action">
                                <form method="dialog">

                                    <button className="btn btn-square">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-6 w-6"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </form>
                            </div>
                            {

                            }
                            {
                                signin ? (
                                    <Signin setSignin={setSignin} />
                                ) : (
                                    <Signup setSignin={setSignin} />
                                )
                            }

                        </div>
                    </dialog>
                </div>
            </nav >

        </>
    )
}

export default Navbar