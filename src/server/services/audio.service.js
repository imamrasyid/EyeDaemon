const { spawn } = require("child_process");
const logger = require("../utils/logger");
const { config } = require("../config");
const infoCache = new Map();

// =============================
// 🔹 Helper Functions
// =============================
function normalizeInput(q) {
    return `ytsearch1:${q}`;
}

function sanitizeQuery(q) {
    return q.replace(/[;&|$><`]/g, "").trim();
}

function safeKill(proc) {
    if (!proc || proc.killed) return;
    try { proc.kill("SIGTERM"); } catch { }
}

function buildFilterArgs(preset) {
    if (!preset || preset === "none") return [];

    switch (preset) {
        case "bassboost":
            return ["-af", "bass=g=10"];
        case "nightcore":
            return ["-af", "asetrate=48000*1.1,atempo=1.1,aresample=48000"];
        case "vaporwave":
            return ["-af", "asetrate=44100*0.85,atempo=1,aresample=44100"];
        case "8d":
            return ["-af", "apulsator=mode=sine:hz=0.09"];
        case "karaoke":
            return ["-af", "stereotools=mlev=0.015"];
        default:
            if (preset.startsWith("pitch:")) {
                const p = Math.max(0.5, Math.min(2, Number(preset.split(":")[1] || 1)));
                return ["-af", `asetrate=48000*${p},aresample=48000`];
            }
            if (preset.startsWith("speed:")) {
                const s = Math.max(0.5, Math.min(2, Number(preset.split(":")[1] || 1)));
                return ["-af", `atempo=${s}`];
            }
            return [];
    }
}

// =============================
// 🔹 Fetch Metadata
// =============================
async function getInfo(query) {
    const startPerf = performance.now();
    if (infoCache.has(query)) {
        logger.debug(`getInfo cache hit for "${query}" in ${(performance.now() - startPerf).toFixed(2)}ms`);
        return infoCache.get(query);
    }

    const input = `ytsearch1:${query}`;
    const yt = spawn("yt-dlp", [
        "-j",               // single-line JSON, much faster than -J
        "--flat-playlist",  // skip downloading playlist info
        "--no-warnings",
        "--quiet",
        "--no-playlist",
        "--skip-download",  // do not touch media files
        "--write-info-json",// force metadata-only fetch
        "-f", "bestaudio",  // limit to audio formats only
        input
    ]);

    let json = "", err = "";
    yt.stdout.on("data", d => json += d.toString());
    yt.stderr.on("data", d => err += d.toString());

    return new Promise((resolve, reject) => {
        yt.on("close", (code) => {
            const elapsed = (performance.now() - startPerf).toFixed(2);
            if (code !== 0) {
                logger.error(`getInfo failed for "${query}" after ${elapsed}ms`);
                return reject(new Error(err || "yt-dlp failed"));
            }

            try {
                const data = JSON.parse(json);
                const e = data.entries?.[0] || data;
                const result = {
                    title: e.title,
                    url: e.webpage_url || e.url,
                    durationSec: Number(e.duration || 0),
                    thumbnail: e.thumbnail || e.thumbnails?.pop()?.url || null
                };
                infoCache.set(query, result);
                setTimeout(() => infoCache.delete(query), 10 * 60_000);
                logger.debug(`getInfo resolved for "${query}" in ${elapsed}ms`);
                resolve(result);
            } catch (ex) {
                logger.error(`getInfo parsing failed for "${query}" after ${elapsed}ms`);
                reject(new Error("Invalid metadata: " + ex.message));
            }
        });
    });
}

// =============================
// 🔹 Stream Audio
// =============================
async function streamAudio(query, res, opts = {}) {
    const startPerf = performance.now();
    const { start = 0, filter = "none", format = "webm" } = opts;
    const input = normalizeInput(sanitizeQuery(query));

    logger.info(`🎧 stream: ${input} start=${start}s filter=${filter} format=${format}`);

    res.setHeader("Content-Type", `audio/${format}`);
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-store");

    const yt = spawn("yt-dlp", [
        "-f", "bestaudio",
        "--no-cache-dir",
        "--no-playlist",
        "-o", "-",
        "--quiet", "--no-warnings",
        input
    ]);

    let ytErr = "";
    yt.stderr.on("data", d => ytErr += d.toString());
    yt.on("error", err => logger.error("yt-dlp spawn error:", err));

    const TIMEOUT_MS = 60000;
    const ytTimeout = setTimeout(() => {
        logger.warn("⏰ yt-dlp timeout reached");
        safeKill(yt);
    }, TIMEOUT_MS);

    const needFfmpeg = (start > 0) || (filter && filter !== "none") || (format !== "webm");
    const startTime = Date.now();

    if (needFfmpeg) {
        const ffArgs = [
            "-loglevel", "error",
            "-hide_banner", "-nostats",
            ...(start > 0 ? ["-ss", String(start)] : []),
            "-i", "pipe:0",
            ...buildFilterArgs(filter),
            "-f", format,
            "-acodec", format === "mp3" ? "libmp3lame" : "libopus",
            "-b:a", "128k",
            "pipe:1"
        ];

        const ff = spawn(config.ffmpegPath || "ffmpeg", ffArgs);

        yt.stdout.pipe(ff.stdin);
        ff.stdout.pipe(res);

        let ffErr = "";
        ff.stderr.on("data", d => ffErr += d.toString());
        ff.on("error", err => logger.error("ffmpeg spawn error:", err));

        const closeAll = () => { safeKill(ff); safeKill(yt); clearTimeout(ytTimeout); };
        res.on("close", closeAll);
        res.on("error", closeAll);

        ff.on("close", (code) => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            const perfElapsed = (performance.now() - startPerf).toFixed(2);
            if (code === 0) {
                logger.info(`✅ stream done (ffmpeg) in ${elapsed}s, total ${perfElapsed}ms`);
            } else {
                logger.error(`ffmpeg exited ${code}: ${ffErr}`);
            }
            closeAll();
        });
    } else {
        yt.stdout.pipe(res);

        const closeAll = () => { safeKill(yt); clearTimeout(ytTimeout); };
        res.on("close", closeAll);
        res.on("error", closeAll);

        yt.on("close", (code) => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            const perfElapsed = (performance.now() - startPerf).toFixed(2);
            if (code === 0) {
                logger.info(`✅ stream done (direct) in ${elapsed}s, total ${perfElapsed}ms`);
            } else {
                logger.error(`yt-dlp exited ${code}: ${ytErr}`);
            }
        });
    }
}

module.exports = { streamAudio, getInfo };
