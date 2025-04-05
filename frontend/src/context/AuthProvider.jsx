import { createContext, useState, useEffect } from "react";
import Cookies from "js-cookie";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const session = Cookies.get("session_token");
    if (session) {
      setUser({ token: session });
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch("http://localhost:8080/api/signup/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include", // Ensures cookies are stored
      });

      const data = await response.json();
      if (response.ok) {
        Cookies.set("session_token", data.token, { expires: 1 }); // Expires in 1 day
        setUser({ token: data.token });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const logout = () => {
    Cookies.remove("session_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
