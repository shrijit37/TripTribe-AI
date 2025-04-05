import { useContext, useRef, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthProvider";
import { useNavigate } from "react-router";
    
const Signin = () => {
    const emailRef = useRef();
    const passRef = useRef();
    const { login, user } = useContext(AuthContext);
    const [error, setError] = useState("");
    const navigate = useNavigate(); // 🚀 For redirection

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(emailRef.current.value, passRef.current.value);
        } catch (err) {
            setError("Login failed. Please check your credentials.");
        }
    };

    // ✅ Redirect to dashboard if user is logged in
    // useEffect(() => {
    //     if (user) {
    //         console.log("User logged in:", user);
    //         console.log(user);
    //         navigate("/"); // Redirect after login
    //     }
    // }, [user, navigate]);

    return (
        <div className="p-3 mb-10">
            {user ? (
                <div className="text-center text-green-600">✅ You are already logged in!</div>
            ) : (
                <>
                    <div className="text-3xl text-center">Sign-in</div>
                    <label className="input input-bordered flex items-center gap-2 m-6">
                        <input type="text" className="grow" placeholder="Email" ref={emailRef} />
                    </label>

                    <label className="input input-bordered flex items-center gap-2 m-6">
                        <input type="password" className="grow" placeholder="Password" ref={passRef} />
                    </label>

                    {error && <div className="text-red-500 text-center">{error}</div>}

                    <div className="flex flex-col justify-evenly">
                        <button className="btn btn-outline btn-success flex mt-5" onClick={handleSubmit}>
                            Login
                        </button>
                    </div>
                </>
            )}
        </div>
     );
};

export default Signin;
