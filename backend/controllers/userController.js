import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";
import bcrypt from "bcryptjs";
import generateToken from "../utils/createToken.js";

const createUser = asyncHandler(async (req, res) => {
    try {
        const { fname, lname, email, password } = req.body;

        if (!fname || !email || !password) {
            console.log("Missing fields in request body:", req.body);
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
        generateToken(res, newUser._id);
        return res.status(201).json({ _id: newUser.id,
            fname: newUser.fname,
    
            email: newUser.email,

         });
    } catch (error) {
        // Log the error for debugging
        console.error("Error in createUser:", error);
        // Handle Mongoose validation errors
        if (error.name === "ValidationError") {
            return res.status(400).json({ message: error.message });
        }
        // Handle duplicate key error (race condition)
        if (error.code === 11000) {
            return res.status(400).json({ message: "User already exist" });
        }
        // Generic server error
        return res.status(500).json({ message: "Something went wrong: " + error.message });
    }
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email });

    if (existingUser) {
        const isPasswordValid = await bcrypt.compare(password, existingUser.password);
        if (isPasswordValid) {
            generateToken(res, existingUser._id);
            return res.json({ email: existingUser.email, fname: existingUser.fname, lname: existingUser.lname, userAddress: existingUser.userAddress, userInterest: existingUser.userInterest });
        }
    }
    return res.status(401).json({ message: "Invalid email or password" });
});

const logoutUser = asyncHandler(async (req, res) => {
    res.cookie('jwt', "", { httpOnly: true, expires: new Date(0) });
    return res.sendStatus(200);
});

const getCurrentUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findOne(req.user._id);
    if (user) {
        return res.json({
            _id: user._id,
            fname: user.fname,
            lname: user.lname,
            email: user.email,
        });
    } else {
        return res.status(404).json({ message: "User not found" });
    }
});


const checkDuplicate = asyncHandler(async (req, res) => {
    const { email } = req.body;
    console.log(email);
    const user = await User.findOne({email});
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