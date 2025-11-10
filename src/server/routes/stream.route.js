const express = require("express");
const router = express.Router();
const { streamAudio, getInfo } = require("../services/audio.service");

router.get("/stream", async (req, res) => {
    try {
        const { query, start, filter } = req.query;
        if (!query || typeof query !== "string" || !query.trim()) return res.status(400).json({ error: "Missing or invalid 'query'" });
        if (query.length > 500) return res.status(400).json({ error: "Query too long" });
        if (query.includes("..") || query.startsWith("/") || query.startsWith("http")) return res.status(400).json({ error: "Invalid characters in query" });

        res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "X-XSS-Protection": "1; mode=block" });
        await streamAudio(query.trim(), res, { start: isFinite(Number(start)) ? Number(start) : 0, filter: String(filter || "none") });
    } catch (e) {
        console.error("Stream route error:", e);
        if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/info", async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || typeof query !== "string" || !query.trim()) return res.status(400).json({ error: "Missing or invalid 'query'" });
        if (query.length > 500) return res.status(400).json({ error: "Query too long" });
        if (query.includes("..") || query.startsWith("/") || query.startsWith("http")) return res.status(400).json({ error: "Invalid characters in query" });
        const meta = await getInfo(query.trim());
        res.json({ success: true, ...meta });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
