import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
    console.log("api is working");
    res.send("API is working");
});

export default router;