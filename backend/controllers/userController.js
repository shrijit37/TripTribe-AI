import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";

// Auth is owned by the shared Better Auth service (auth.shrijit.tech). This is
// only the app's own copy of the profile, keyed by the shared auth user id.
const getCurrentUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    return res.json({
        _id: user._id,
        fname: user.fname,
        lname: user.lname,
        email: user.email,
        recentSearch: user.recentSearch,
    });
});

const updateCurrentUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    user.fname = req.body.fname || user.fname;
    user.lname = req.body.lname || user.lname;
    user.userInterest = req.body.userInterest || user.userInterest;
    user.userAddress = req.body.userAddress || user.userAddress;

    const updatedUser = await user.save();
    return res.json({
        _id: updatedUser._id,
        fname: updatedUser.fname,
        lname: updatedUser.lname,
        email: updatedUser.email,
        userInterest: updatedUser.userInterest,
        userAddress: updatedUser.userAddress,
    });
});

export { getCurrentUserProfile, updateCurrentUserProfile };