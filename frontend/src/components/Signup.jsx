import { useState } from "react";
import { useDispatch } from "react-redux";
import { ToastContainer, toast } from 'react-toastify';
import { useRegisterMutation } from "../../Redux/api/userApiSlice";
import { setCredentials } from "../../Redux/auth/authSlice";
import auth from "../FirebaseConfig";
import { sendEmailVerification, createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";


const Signup = (props) => {
    const [error, setError] = useState("");
    const dispatch = useDispatch();
    const [register] = useRegisterMutation();

    //Signup details
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fname, setFname] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [isDataEntered, setIsDataEntered] = useState(false)
    const submitHandler = async () => {
        if (email && password) {
            if (password !== confirmPassword) {
                setError("Passwords do not match.");
                return;
            }
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(email)) {
                setError("Please enter a valid email address.");
                return;
            }
            const res = await fetch(import.meta.env.VITE_EMAIL_VERIFICATION_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email: email})
            });
            console.log(res.staus);


            try {
                setError("");

                // console.log(res);
                setIsDataEntered(true);

            } catch (error) {
                console.dir(error);
                setError(error.data.message || "Something went wrong. Please try again.");
                return;
            }

            const userCred = await createUserWithEmailAndPassword(auth, email, password);


            await sendEmailVerification(userCred.user);

            const intervalId = setInterval(async () => {
                onAuthStateChanged(auth, (user) => {
                    if (user) {
                        user.reload().then(async () => {
                            if (user.emailVerified) {
                                console.log(`User ${user.email} has verified their email.`);

                                toast("Email verified successfully!");
                                console.log("Email verified successfully!");
                                clearInterval(intervalId); 
                                try {
                                    console.log("Registering user...");
                                    console.log(email);
                                    const res = await register({
                                    email: email,
                                    password: password,
                                    fname: fname,
                                    
                                }).unwrap();
                                console.log("usernameRef.current.value")
                                dispatch(setCredentials({ ...res }));
                            } catch (error) {
                                setError(error.data.message || "Something went wrong. Please try again.");
                                return;
                            }
                                // window.location.href = "/"; // Redirect to home page

                            } else {
                                // console.log(`User ${user.email} has NOT verified their email.`);
                            }
                        }).catch((error) => {
                            console.error("Error reloading user:", error);
                        });
                    } else {
                        console.log("No user is signed in.");
                    }
                });
            }, 1000)
        }


        else {
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
                    <input type="text" className="grow" placeholder="Username" onChange={(e) => setFname(e.target.value)} />
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
                    <input type="text" className="grow" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
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
                    <input type="password" className="grow" placeholder="password" onChange={(e) => setConfirmPassword(e.target.value)} />
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
                    <input type="text" className="grow" placeholder="Confirm Password" onChange={(e)=>{setPassword(e.target.value)}} />
                </label>
                {error && <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
                    <span className="font-medium">{error}</span>
                </div>}
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
                <div>
                    <div className="text-2xl text-center mt-9">Check your email for verification link.</div>
                    <div className="text-md text-center">Please check span folder.</div>
                </div>
            }



        </div>
    )
}

export default Signup