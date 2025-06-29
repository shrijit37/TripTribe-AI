import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { apiSlice } from './api/apislice';
import authReducer from './auth/authSlice';

const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) => {
    const middleware = getDefaultMiddleware().concat(apiSlice.middleware);
    return middleware;
  },
  devTools: true,
});

setupListeners(store.dispatch);
export default store;