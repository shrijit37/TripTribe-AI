import { fetchBaseQuery, createApi } from '@reduxjs/toolkit/query/react';
import { BASE_URL } from '../constants';

const baseQuery = fetchBaseQuery({
  baseUrl: BASE_URL,
  credentials: 'include', // Required to send the jwt cookie
});

export const apiSlice = createApi({
  reducerPath: 'api', // Explicitly set reducerPath
  baseQuery,
  tagTypes: ['Auth', 'UserProfile'], // Define tags used in userApiSlice
  endpoints: () => {
    return {};
  },
});