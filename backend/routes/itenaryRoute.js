import express from "express";
import getResponse from "../controllers/gptResponse.js";
import saveItenary from "../controllers/saveItenary.js";
import DataModel from "../models/itenaryModel.js";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import { authenticate } from "../middleware/authenticate.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { days, cityName, budget, email } = req.body;
        console.log("API is working");
        console.log(days, cityName, budget, email);

        const response = await getResponse(days, cityName, budget);

        // console.log(response)
        await saveItenary(response, cityName, email);
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


router.get("/all", authenticate, async (req, res) => {
    try {
        const user = req.user;
        let recentSearch = user.recentSearch || [];
        const cityList = recentSearch.map((item) => {
            return {
                cityName: item.city,
                time: item.createdAt,
                itenary: item.itenary,
                uuid: item.uuid
            };
        });
        res.json(cityList);
    } catch (error) {
        console.error("Error fetching itenaries:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.get("/city-image", async (req, res) => {
    try {
        const query = req.query.query;
        if (!query) {
            return res.status(400).json({ error: "Missing query parameter" });
        }
        const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || process.env.VITE_GOOGLE_CUSTOM_SEARCH_API_KEY;
        const cx = "c63fff3e039f04940";
        const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&searchType=image&cx=${cx}&key=${apiKey}`;
        
        const googleRes = await fetch(url);
        const data = await googleRes.json();
        res.json(data);
    } catch (error) {
        console.error("Error in proxy city image:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.get("/proxy-image", async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            return res.status(400).json({ error: "Missing url parameter" });
        }
        const imageRes = await fetch(imageUrl);
        if (!imageRes.ok) {
            return res.status(imageRes.status).send("Failed to fetch image");
        }
        const contentType = imageRes.headers.get("content-type");
        if (contentType) {
            res.setHeader("Content-Type", contentType);
        }
        const buffer = await imageRes.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch (error) {
        console.error("Error in proxy-image:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
