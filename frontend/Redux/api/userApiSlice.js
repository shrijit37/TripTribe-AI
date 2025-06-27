import { apiSlice } from './apislice';
import { USER_URL } from '../constants';
import {setCredentials} from "../auth/authSlice";
export const userApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => {
    return {
      login: builder.mutation({
        query: (data) => ({
          url: `${USER_URL}/auth`,
          method: 'POST',
          body: data,
        }),
        invalidatesTags: ['Auth'],
        async onQueryStarted(arg, { dispatch, queryFulfilled }) {
          try {
            const { data } = await queryFulfilled;
            dispatch(setCredentials(data)); 
          } catch (error) {
            console.error('Login error:', error);
          }
        },
      }),
      register: builder.mutation({
        query: (data) => ({
          url: `${USER_URL}/`,
          method: 'POST',
          body: data,
        }),
        invalidatesTags: ['Auth'],
        async onQueryStarted(arg, { dispatch, queryFulfilled }) {
          try {
            const { data } = await queryFulfilled;
          } catch (error) {
            console.error('Register error:', error);
          }
        },
      }),
      logout: builder.mutation({
        query: (data) => ({
          url: `${USER_URL}/logout`,
          method: 'POST',
          body: data,
        }),
        invalidatesTags: ['Auth'],
        async onQueryStarted(arg, { dispatch, queryFulfilled }) {
          try {
            const { data } = await queryFulfilled;
          } catch (error) {
            console.error('Register error:', error);
          }
        },
      }),
      profile: builder.query({
        query: () => ({
          url: `${USER_URL}/profile`,
          method: 'GET',
        }),
        providesTags: ['UserProfile'],
        async onQueryStarted(arg, { dispatch, queryFulfilled }) {
          try {
            const { data } = await queryFulfilled;
            dispatch(setCredentials(data));
          } catch (error) {
            console.error('Profile error:', error);
          }
        },
        
      }),
    };
  },
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useProfileQuery,
  useLogoutMutation,
  util: userApiUtil
} = userApiSlice;