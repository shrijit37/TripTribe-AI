import express from "express";
import getResponse from "../controllers/gptResponse.js";
import saveItenary from "../controllers/saveItenary.js";
import DataModel from "../models/itenaryModel.js";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { days, cityName, budget, email } = req.body;
        console.log("API is working");
        console.log(days, cityName, budget, email);

        const response = await getResponse(days, cityName, budget);

        // console.log(response)
        saveItenary(response, cityName, email);
        res.json(response); // Send the actual response
    } catch (error) {
        console.error("Error fetching response:", error);
        if (error instanceof SyntaxError) {
            res.status(500).json({ error: "Invalid JSON response from OpenAI" });
        } else {
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
});


router.get("/all", async (req, res) => {
    try {
        let token;
        if (req.cookies.jwt) {
            token = req.cookies.jwt;
        } else {
            return res.status(401).json({ message: "no jwt cookie" });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log(decoded.email);
        // res.send(data);
        
        const user = await User.findOne({ userEmail: decoded.email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        let recentSearch = user.recentSearch;
        // res.send(recentSearch);
        const cityList = recentSearch.map((items) =>{return {cityName : items.city, time : items.createdAt}});
        res.json(cityList);

    } catch (error) {
        console.error("Error fetching itenaries:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// router.get("/recent", async (req, res) => {
//     const {id} = req.query;
//     try {
//         const iten = await DataModel.findOne({uuid : id});
//         if (iten == null) {
//             return res.status(404).json({message : "invalid request"});
//         }
//         res.status(200).json(iten);
//     } catch(e) {
//         return res.status(500).json(error.message);
//     }
// })

export default router;
