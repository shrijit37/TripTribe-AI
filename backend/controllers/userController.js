import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";
import bcrypt from "bcryptjs";
import generateToken from "../utils/createToken.js";

// const createUser = asyncHandler(async (req, res) => {
//     try {
//         const { fname, lname, email, password } = req.body;

//         if (!fname || !email || !password) {
//             console.log("Missing fields in request body:", req.body);
//             return res.status(400).json({ message: "Please fill all the fields" });
//         }

//         const userExist = await User.findOne({ email });
//         if (userExist) {
//             return res.status(400).json({ message: "User already exist" });
//         }

//         const salt = await bcrypt.genSalt(10);
//         const hashedPassword = await bcrypt.hash(password, salt);
//         const newUser = await User.create({
//             fname,
//             lname,
//             email,
//             password: hashedPassword,
//         });
//         const token = generateToken(newUser._id, email);
//         res.cookie('jwt', token, {
//             httpOnly: true,
//             secure: process.env.NODE_ENV !== 'development',
//             sameSite: 'strict',
//             maxAge: 30 * 24 * 60 * 60 * 1000
//         });
//         return res.status(201).json({
//             _id: newUser.id,
//             fname: newUser.fname,
//             email: newUser.email
//         });
//     } catch (error) {
//         // Log the error for debugging
//         console.error("Error in createUser:", error);
//         // Handle Mongoose validation errors
//         if (error.name === "ValidationError") {
//             return res.status(400).json({ message: error.message });
//         }
//         // Handle duplicate key error (race condition)
//         if (error.code === 11000) {
//             return res.status(400).json({ message: "User already exist" });
//         }
//         // Generic server error
//         return res.status(500).json({ message: "Something went wrong: " + error.message });
//     }
// });


const createUser = asyncHandler(async (req, res) => {
    try {
        const { fname, lname, email, password } = req.body;

        if (!fname || !email || !password) {
            return res.status(400).json({ message: "Please fill all the fields" });
        }

        const userExist = await User.findOne({ email });
        if (userExist) {
            return res.status(400).json({ message: "User already exist" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = await User.create({
            fname,
            lname,
            email,
            password: hashedPassword,
        });

        generateToken(res, newUser._id); // ✅ Correct usage

        return res.status(201).json({
            _id: newUser.id,
            fname: newUser.fname,
            email: newUser.email
        });
    } catch (error) {
        // same error handling
    }
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email });

    if (existingUser) {
        const isPasswordValid = await bcrypt.compare(password, existingUser.password);
        if (isPasswordValid) {
            generateToken(res, existingUser._id);
            // res.cookie('jwt', token, {
            //     httpOnly: true,
            //     secure: process.env.NODE_ENV !== 'development',
            //     sameSite: 'strict',
            //     maxAge: 30 * 24 * 60 * 60 * 1000
            // });
            res.status(201).json({
                _id: existingUser._id,
                fname: existingUser.fname,
                email: existingUser.email,
                recentSearch: existingUser.recentSearch,
            });
            return;
        }
    }
    return res.status(401).json({ message: "Invalid email or password" });
});

const logoutUser = asyncHandler(async (req, res) => {
    res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
    });
    console.log("logout done");
    return res.status(200).json({ message: 'Logged out successfully' });
});

const getCurrentUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findOne(req.user._id);
    if (user) {
        return res.json({
            _id: user._id,
            fname: user.fname,
            lname: user.lname,
            email: user.email,
            recentSearch: user.recentSearch,
        });
    } else {
        return res.status(404).json({ message: "User not found" });
    }
});


const checkDuplicate = asyncHandler(async (req, res) => {
    const { email } = req.body;
    console.log(email);
    const user = await User.findOne({ email });
    if (user) {
        return res.status(409).json({ message: "User already exists" });
    } else {
        return res.status(200).json({ message: "User not found" });
    }
});
const updateCurrentUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        user.email = req.body.email || user.email;
        user.fname = req.body.fname || user.fname;
        user.lname = req.body.lname || user.lname;
        user.userInterest = req.body.userInterest || user.userInterest;
        user.userAddress = req.body.userAddress || user.userAddress;

        if (req.body.password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(req.body.password, salt);
            user.password = hashedPassword;
        }

        const updatedUser = await user.save();

        return res.json({
            _id: updatedUser._id,
            fname: updatedUser.fname,
            lname: updatedUser.lname,
            email: updatedUser.email,
            userInterest: updatedUser.userInterest,
            userAddress: updatedUser.userAddress,
        });
    } else {
        return res.status(404).json({ message: "User not found" });
    }
});
export { createUser, loginUser, logoutUser, getCurrentUserProfile, updateCurrentUserProfile, checkDuplicate };