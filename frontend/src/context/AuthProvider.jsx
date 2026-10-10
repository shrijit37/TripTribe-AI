import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { getSession, signOut } from "../lib/auth-client";
import { setCredentials, logOut } from "../../Redux/auth/authSlice";

const AuthContext = createContext({ user: null, loading: true, refresh: async () => {}, logout: async () => {} });

// Navbar/other components read the session from redux (state.auth.userInfo),
// so the shared session is mirrored there on every refresh.
export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const session = await getSession();
      const sessionUser = session?.user;
      const next = sessionUser
        ? { ...sessionUser, fname: sessionUser.name?.split(" ")[0] || sessionUser.email }
        : null;
      setUser(next);
      dispatch(next ? setCredentials(next) : logOut());
    } catch {
      setUser(null);
      dispatch(logOut());
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await signOut().catch(() => {});
    await refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
