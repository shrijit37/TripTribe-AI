import { createSlice } from "@reduxjs/toolkit";


const initialState = {
    userInfo : localStorage.getItem('userInfo') ? JSON.parse(localStorage.getItem('userInfo')) : null,
}
const authSlice = createSlice({
    name : 'auth',
    initialState,
    reducers:{
        setCredentials : (state, action) => {
            state.userInfo = action.payload;
            localStorage.setItem('userInfo', JSON.stringify(action.payload));
            const expirationTime = new Date(new Date().getTime() + 14 * 24* 60 * 60 * 1000); 
            localStorage.setItem('expirationTime', expirationTime);
        },
        logOut : (state) => {
            state.userInfo = null;
            localStorage.removeItem('userInfo');
            localStorage.removeItem('expirationTime');
        },
    }
})

export const {setCredentials, logOut} = authSlice.actions;
export default authSlice.reducer;