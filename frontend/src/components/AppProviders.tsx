"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Provider } from "react-redux";
import { store } from "@/store";
import { useAppDispatch } from "@/store";
import { hydrate } from "@/store/authSlice";
import { loadMapsApi } from "@/lib/maps";


/**
 * The client-side half of the app shell.
 *
 * Everything interactive lives behind this boundary: Redux, the Google Maps
 * script, and the account session. The server renders the same providers with a
 * fresh store per request, so no visitor's session can reach another's HTML.
 */
export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <Provider store={store}>
      <SessionSync>
        <MapsBoot>{children}</MapsBoot>
      </SessionSync>
    </Provider>
  );
}

/**
 * Re-read `localStorage` after mount.
 *
 * The server cannot see the stored user, so the first paint shows signed-out.
 * Without this the navbar would stay signed-out until a reload even though the
 * cookie is live — the original mirrored the session on every refresh from a
 * client-side `useEffect`, and this is that same read.
 */
function SessionSync({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(hydrate());
  }, [dispatch]);
  return <>{children}</>;
}

/**
 * Load the Maps script once for the whole app.
 *
 * Both Autocomplete consumers mount independently, and the Hero's is above the
 * fold while the Search stepper's is not. Loading it here means the first
 * keystroke into the city field already finds the API warm, instead of
 * waiting on a script tag that did not exist when the field mounted.
 */
function MapsBoot({ children }: { children: ReactNode }) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void loadMapsApi();
  }, []);
  return <>{children}</>;
}