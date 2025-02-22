import express from "express";
import getResponse from "../controllers/gptResponse.js";

const router = express.Router();

router.get("/", async (req, res) => { 
    try {
        const { days, cityName, budget } = req.body; 
        console.log("API is working");
        console.log(days, cityName, budget);
        
        const response = await getResponse(days, cityName, budget);
        console.log(response)
        res.json(response); // Send the actual response
    } catch (error) {
        console.error("Error fetching response:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
