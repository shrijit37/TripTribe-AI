import { useNavigate } from "react-router"
import { useState } from "react";

import Signin from "./Signin";
import Signup from "./Signup";

const Navbar = () => {
    let navigate = useNavigate();
    const [signin, setSignin] = useState(true);
    return (
        <>
            <nav className="flex justify-between items-center w-[92%] mx-auto my-4">
                <div className="">
                    <div className="text-5xl font-poppin cursor-pointer" onClick={() => { navigate("/") }}>TripTribe</div>
                </div>

                {/* <div className="">
                    <ul className="">
                        <li className="">
                            <a href="" className="">Home</a>
                        </li>
                        <li className="">
                            <a href="" className=""></a>
                        </li>
                        <li className="">
                            <a href="" className=""></a>
                        </li>
                        <li className="">
                            <a href="" className=""></a>
                        </li>
                    </ul>
                </div> */}

                <div className="flex justify-between">
                    <button className="btn btn-primary mx-5" onClick={() => navigate("/search")}>Try it! 💫</button>
                    <button className="btn" onClick={() => document.getElementById('my_modal_4').showModal()}>Sign-in</button>
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


                            {signin ? <Signin /> : <Signup />}
                        </div>
                    </dialog>
                </div>
            </nav>

        </>
    )
}

export default Navbar