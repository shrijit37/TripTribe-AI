import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useLoginMutation } from "../../Redux/api/userApiSlice";
import { setCredentials } from "../../Redux/auth/authSlice";
import { useNavigate } from "react-router";


const Signin = (props) => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [login] = useLoginMutation();
    const [error, setError] = useState("");
    const userInfo = useSelector((state) => state.auth);
    const dispatch = useDispatch();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await login({ email, password }).unwrap();
            dispatch(setCredentials({ ...res }));
            navigate('/')
        } catch (error) {
            setError(error.data.message);
        }
    }

    return (
        <div className="p-3 mb-10">
            {userInfo.userInfo ? (
                <div className="text-center text-green-600">✅ Welcome &nbsp; {userInfo.userInfo.fname}</div>
            ) : (
                <>
                    <div className="">
                        <div className="text-3xl text-center">Sign-in</div>
                        <label className="input input-bordered flex items-center gap-2 m-6">
                            <input type="text" className="grow" placeholder="Email" onChange={(e) => setEmail(e.target.value.toLowerCase())} />
                        </label>

                        <label className="input input-bordered flex items-center gap-2 m-6">
                            <input type="password" className="grow" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
                        </label>
                        <div className="flex flex-col justify-evenly">
                            <div className="text-md flex text-center">
                                Don't have an account?&nbsp;
                                <div
                                    className="text-md cursor-pointer text-blue-500"
                                    onClick={() => props.setSignin(false)} // Switch to Signup
                                >
                                    Sign up here.
                                </div>
                            </div>
                            {error && <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
                                <span className="font-medium">{error}</span>
                            </div>}
                            <button className="btn btn-outline btn-success flex mt-5" onClick={handleSubmit}>
                                Login
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Signin;
