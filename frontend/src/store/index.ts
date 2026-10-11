import {
  configureStore,
  type Dispatch,
  type EnhancedStore,
  type UnknownAction,
} from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { useDispatch, useSelector } from "react-redux";
import authReducer, { type AuthState } from "./authSlice";

/**
 * One store per process.
 *
 * A module-scope `configureStore` is created once on the server and shared by
 * every request — which would leak one visitor's session into another's
 * response. The factory below is the standard fix: the server builds one per
 * request, the browser keeps a single instance on `globalThis`.
 */
export const makeStore = () =>
  configureStore({
    reducer: { auth: authReducer },
    devTools: true,
  });

/** The store contract, named here so no consumer has to infer it. */
export type RootState = { auth: AuthState };
export type AppDispatch = Dispatch<UnknownAction>;

export type AppStore = EnhancedStore<RootState, UnknownAction>;

const globalForStore = globalThis as unknown as { __triptribeStore?: AppStore };

export const store: AppStore = globalForStore.__triptribeStore ?? makeStore();
globalForStore.__triptribeStore = store;

setupListeners(store.dispatch);

/** Typed hooks — the untyped ones return `any` for state and lose `strict`. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();