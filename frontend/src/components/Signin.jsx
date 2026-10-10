import { useState } from "react";
import { useNavigate } from "react-router";
import AuthProviders from "./AuthProviders";
import { useAuth } from "../context/AuthProvider";
import { signInWithEmail } from "../lib/auth-client";

const ERRORS = {
  EMAIL_NOT_VERIFIED: "Verify your email first — check your inbox for the link we sent.",
  INVALID_EMAIL_OR_PASSWORD: "That email and password don't match.",
};

const Signin = (props) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { user, refresh } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmail(email.toLowerCase(), password);
      await refresh();
      navigate("/");
    } catch (err) {
      setError(ERRORS[err.message] || err.message);
    }
  };

  return (
    <div className="p-3 mb-10">
      {user ? (
        <div className="text-center text-green-600">✅ Welcome &nbsp; {user.fname}</div>
      ) : (
        <div className="">
          <div className="text-3xl text-center">Sign-in</div>
          <AuthProviders onError={setError} />
          <div className="divider text-xs opacity-60">or with email</div>
          <label className="input input-bordered flex items-center gap-2 m-6">
            <input type="email" className="grow" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
          </label>

          <label className="input input-bordered flex items-center gap-2 m-6">
            <input type="password" className="grow" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
          </label>
          <div className="flex flex-col justify-evenly">
            <div className="text-md flex text-center">
              Don&apos;t have an account?&nbsp;
              <div className="text-md cursor-pointer text-blue-500" onClick={() => props.setSignin(false)}>
                Sign up here.
              </div>
            </div>
            {error && (
              <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
                <span className="font-medium">{error}</span>
              </div>
            )}
            <button className="btn btn-outline btn-success flex mt-5" onClick={handleSubmit}>
              Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Signin;
