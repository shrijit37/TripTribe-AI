import express from "express";
import mongoose from "mongoose";

const router = express.Router();

// Uniform fleet health contract: GET /health -> exactly
// { status, service, version, checks }. 503 when the database is down.
router.get("/", (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  const body = {
    status: dbUp ? "ok" : "down",
    service: "triptribe-api",
    version: process.env.APP_VERSION || "unknown",
    checks: { database: dbUp ? "up" : "down" },
  };
  res.status(dbUp ? 200 : 503).json(body);
});

export default router;
