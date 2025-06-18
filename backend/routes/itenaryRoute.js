import express from "express";
import getResponse from "../controllers/gptResponse.js";
import User from "../models/userModel.js";
const router = express.Router();

router.post("/", async (req, res) => { 
    try {
        const { days, cityName, budget } = req.body; 
        console.log("API is working");
        console.log(days, cityName, budget);
        
        const response = await getResponse(days, cityName, budget);

        console.log(response)
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

export default router;
