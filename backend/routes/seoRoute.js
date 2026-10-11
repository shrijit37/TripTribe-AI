import express from "express";
import { buildCityCatalogue } from "../services/catalogue.js";

/**
 * The data source behind the public city pages.
 *
 * The Next.js site renders these pages on the server, so this is a same-origin
 * JSON read rather than something a browser calls directly. Kept in the API
 * service rather than in Next.js because the Places key, the quota reasoning
 * and the cache all already live here — splitting them would mean two places
 * reading the same 1,000-call monthly allowance.
 */
const router = express.Router();

// Google resolves the city name far more reliably than it does for a user
// query, and the city page is generated from it. A tight cap keeps this from
// being an open proxy: an unbounded `textQuery` is a bill.
const CITY = /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]{1,60}$/u;

// Cached at the edge for a day and in the browser for an hour. The underlying
// catalogue is cached in Mongo for 90 days, so this is just avoiding a round
// trip for a page nobody is crawling.
router.get("/city-catalogue", async (req, res) => {
    const city = String(req.query.city ?? "").trim();

    if (!CITY.test(city)) {
        return res.status(400).json({ message: "city must be a plain city name" });
    }

    try {
        const catalogue = await buildCityCatalogue(city, { limit: 18 });
        if (!catalogue) {
            // A city Google cannot resolve is not an error the visitor did
            // anything wrong about, and it is not a 500 either.
            return res.status(404).json({ message: `No places found for "${city}"` });
        }
        res.set("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
        return res.json(catalogue);
    } catch (error) {
        console.error("Error building city catalogue:", error);
        return res.status(502).json({ message: "Places are unavailable right now" });
    }
});

export default router;