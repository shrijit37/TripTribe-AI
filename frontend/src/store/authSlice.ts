import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { UserInfo } from "@/lib/types";

/** The auth slice's state, named here for the store to import. */
export interface AuthState {
  userInfo: UserInfo | null;
}

/**
 * The mirrored session.
 *
 * The cookie on `.shrijit.tech` is the real session; this is the app's own
 * record of who is signed in, so the navbar can render without asking on every
 * paint. `localStorage` was read at module scope in the original, which throws
 * under server rendering — `localStorage` is undefined in Node. It is read in a
 * guarded helper instead, so the same slice works on both sides, and
 * `hydrate` re-reads it in the browser after mount.
 */
const readStoredUser = (): UserInfo | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("userInfo");
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  } catch {
    return null;
  }
};

const persist = (user: UserInfo | null) => {
  if (typeof window === "undefined") return;
  if (user) {
    window.localStorage.setItem("userInfo", JSON.stringify(user));
    const expirationTime = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    window.localStorage.setItem("expirationTime", expirationTime.toISOString());
  } else {
    window.localStorage.removeItem("userInfo");
    window.localStorage.removeItem("expirationTime");
    document.cookie = "jwt=; Max-Age=0; path=/;";
  }
};

const authSlice = createSlice({
  name: "auth",
  initialState: { userInfo: readStoredUser() } as AuthState,
  reducers: {
    setCredentials: (state, action: PayloadAction<UserInfo>) => {
      state.userInfo = action.payload;
      persist(action.payload);
    },
    logOut: (state) => {
      state.userInfo = null;
      persist(null);
    },
    update: (state, action: PayloadAction<UserInfo>) => {
      state.userInfo = action.payload;
      persist(action.payload);
    },
    /** Re-read the store after mount, so the server and client agree. */
    hydrate: (state) => {
      state.userInfo = readStoredUser();
    },
  },
});

export const { setCredentials, logOut, update, hydrate } = authSlice.actions;
export default authSlice.reducer;