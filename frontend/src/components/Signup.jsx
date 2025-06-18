import { useState, useRef } from "react";
import SignInButton from "./SignInButton";
import { ToastContainer, toast } from 'react-toastify';
import { useRegisterMutation } from "../../Redux/api/userApiSlice";
import { useDispatch, useSelector } from "react-redux";
const Signup = (props) => {
    const userInfo = useSelector((state) => state.auth);
    const dispatch = useDispatch();
    const [register] = useRegisterMutation();
    const emailRef = useRef();
    const passRef = useRef();
    const [isDataEntered, setIsDataEntered] = useState(false)
    const submitHandler = () => {
        if (emailRef.current.value && passRef.current.value){
            setIsDataEntered(true)
            // setIsDataEntered(false)
        }
        else{
            toast("Enter fill in the details.")
        }
        
    }
    return (
        <div className="p-3 mb-10">
            <ToastContainer
                position="bottom-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick={false}
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
            />
            <div className="text-3xl text-center">Register</div>
            {!isDataEntered ? (<>
                <label className="input input-bordered flex items-center gap-2 m-6">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="h-4 w-4 opacity-70">
                        <path
                            d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 0 0-11.215 0c-.22.578.254 1.139.872 1.139h9.47Z" />
                    </svg>
                    <input type="text" className="grow" placeholder="Username" />
                </label>
                <label className="input input-bordered flex items-center gap-2 m-6">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="h-4 w-4 opacity-70">
                        <path
                            d="M2.5 3A1.5 1.5 0 0 0 1 4.5v.793c.026.009.051.02.076.032L7.674 8.51c.206.1.446.1.652 0l6.598-3.185A.755.755 0 0 1 15 5.293V4.5A1.5 1.5 0 0 0 13.5 3h-11Z" />
                        <path
                            d="M15 6.954 8.978 9.86a2.25 2.25 0 0 1-1.956 0L1 6.954V11.5A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5V6.954Z" />
                    </svg>
                    <input type="text" className="grow" placeholder="Email" ref={emailRef}/>
                </label>

                <label className="input input-bordered flex items-center gap-2 m-6">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="h-4 w-4 opacity-70">
                        <path
                            fillRule="evenodd"
                            d="M14 6a4 4 0 0 1-4.899 3.899l-1.955 1.955a.5.5 0 0 1-.353.146H5v1.5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2.293a.5.5 0 0 1 .146-.353l3.955-3.955A4 4 0 1 1 14 6Zm-4-2a.75.75 0 0 0 0 1.5.5.5 0 0 1 .5.5.75.75 0 0 0 1.5 0 2 2 0 0 0-2-2Z"
                            clipRule="evenodd" />
                    </svg>
                    <input type="password" className="grow" placeholder="password" ref={passRef}/>
                </label>

                <label className="input input-bordered flex items-center gap-2 m-6">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="h-4 w-4 opacity-70">
                        <path
                            fillRule="evenodd"
                            d="M14 6a4 4 0 0 1-4.899 3.899l-1.955 1.955a.5.5 0 0 1-.353.146H5v1.5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2.293a.5.5 0 0 1 .146-.353l3.955-3.955A4 4 0 1 1 14 6Zm-4-2a.75.75 0 0 0 0 1.5.5.5 0 0 1 .5.5.75.75 0 0 0 1.5 0 2 2 0 0 0-2-2Z"
                            clipRule="evenodd" />
                    </svg>
                    <input type="text" className="grow" placeholder="Confirm Password" />
                </label>
                <div className="flex flex-col justify-evenly">
                    <div className="text-md flex text-center">
                        Already have an account?&nbsp;
                        <div
                            className="text-md cursor-pointer text-blue-500"
                            onClick={() => props.setSignin(true)} // Switch to Signin
                        >
                            Sign in here.
                        </div>
                    </div>
                    <button className="btn btn-outline btn-success flex mt-5" onClick={submitHandler}>Register</button>
                </div>
            </>) :
                <div className="mt-8 flex items-center flex-col">
                    <div className="text-xl bold mb-3">Verify Email</div>
                    <SignInButton />
                </div>
            }



        </div>
    )
}

export default Signup