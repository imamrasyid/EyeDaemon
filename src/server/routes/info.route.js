const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const logger = require("../utils/logger");

router.get("/info", async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.status(400).json({ error: "Missing ?query=" });

        const yt = spawn("yt-dlp", [
            "--dump-json",
            "--skip-download",
            "ytsearch1:" + query,
        ]);

        let output = "";
        yt.stdout.on("data", (d) => (output += d.toString()));
        yt.stderr.on("data", (d) => logger.error("yt-dlp:", d.toString()));

        yt.on("close", (code) => {
            if (code !== 0) return res.status(500).json({ error: "yt-dlp failed" });
            try {
                const info = JSON.parse(output.trim());
                res.json({
                    title: info.title,
                    duration: info.duration,
                    uploader: info.uploader,
                    thumbnail: info.thumbnail,
                    url: info.webpage_url,
                });
            } catch (err) {
                res.status(500).json({ error: "Parse JSON failed", detail: err.message });
            }
        });
    } catch (err) {
        logger.error("info.route error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
