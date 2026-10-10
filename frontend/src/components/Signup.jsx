import { useState } from "react";
import AuthProviders from "./AuthProviders";
import { signUpWithEmail } from "../lib/auth-client";

const ERRORS = {
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "That email is already registered — sign in instead.",
  USER_ALREADY_EXISTS: "That email is already registered — sign in instead.",
};

const Signup = (props) => {
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fname, setFname] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isDataEntered, setIsDataEntered] = useState(false);

  const submitHandler = async () => {
    setError("");
    if (!email || !password) {
      setError("Please fill in all the details.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    try {
      await signUpWithEmail(email.toLowerCase(), password, fname || undefined);
      setIsDataEntered(true);
    } catch (err) {
      setError(ERRORS[err.message] || err.message);
    }
  };

  return (
    <div className="p-3 mb-10">
      <div className="text-3xl text-center">Register</div>
      {!isDataEntered ? (
        <>
          <AuthProviders onError={setError} />
          <div className="divider text-xs opacity-60">or with email</div>
          <label className="input input-bordered flex items-center gap-2 m-6">
            <input type="text" className="grow" placeholder="Username" onChange={(e) => setFname(e.target.value)} />
          </label>
          <label className="input input-bordered flex items-center gap-2 m-6">
            <input type="email" className="grow" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="input input-bordered flex items-center gap-2 m-6">
            <input type="password" className="grow" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="input input-bordered flex items-center gap-2 m-6">
            <input type="password" className="grow" placeholder="Confirm Password" onChange={(e) => setConfirmPassword(e.target.value)} />
          </label>
          {error && (
            <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
              <span className="font-medium">{error}</span>
            </div>
          )}
          <div className="flex flex-col justify-evenly">
            <div className="text-md flex text-center">
              Already have an account?&nbsp;
              <div className="text-md cursor-pointer text-blue-500" onClick={() => props.setSignin(true)}>
                Sign in here.
              </div>
            </div>
            <button className="btn btn-outline btn-success flex mt-5" onClick={submitHandler}>
              Register
            </button>
          </div>
        </>
      ) : (
        <div>
          <div className="text-2xl text-center mt-9">Check your email for the verification link.</div>
          <div className="text-md text-center">Click it to finish signing in.</div>
        </div>
      )}
    </div>
  );
};

export default Signup;
