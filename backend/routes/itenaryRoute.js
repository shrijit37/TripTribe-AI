import express from "express";
import getResponse from "../controllers/gptResponse.js";
import saveItenary from "../controllers/saveItenary.js";
import DataModel from "../models/itenaryModel.js";
import { authenticate } from "../middleware/authenticate.js";
import { parsePlanRequest } from "../config/schema.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const parsed = parsePlanRequest(req.body);
        if (!parsed.ok) {
            // 400, not 500: the caller sent something unusable, and the field
            // list is shaped for a form to render per-field messages.
            return res.status(400).json({
                error: "Invalid itinerary request",
                details: parsed.errors,
            });
        }
        // The controller takes the whole parsed request — it owns the solver
        // inputs that are not on the public contract yet (country, travellers,
        // pace, travel mode, start date) and applies the product defaults.
        const response = await getResponse(parsed.value);

        await saveItenary(response, parsed.value.cityName, parsed.value.email);
        res.json(response);
    } catch (error) {
        console.error("Error fetching response:", error);
        // The controller annotates solver failures with the status the caller
        // deserves — 400 for a bad city or day count, 503 when the upstream
        // Places/Routes key is missing, 500 for anything genuinely ours.
        const status = error.status ?? 500;
        res.status(status).json({
            error: status === 400 ? "Could not plan that trip" : "Internal Server Error",
            ...(status === 400 ? { code: error.code ?? "BAD_INPUT" } : {}),
        });
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
