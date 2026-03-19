const { spawn } = require("child_process");
const { ProviderError } = require("../utils/errors");
const logger = require("../utils/logger");

// Regex to detect YouTube URLs — skip ytsearch prefix for direct URLs
const YOUTUBE_URL_REGEX = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//;

/**
 * YtdlpProvider - Wrapper for yt-dlp operations
 * Handles metadata fetching and audio stream extraction from YouTube
 */
class YtdlpProvider {
    constructor(config) {
        this.config = config;
        this.ytdlpPath = config.get("ytdlpPath", "yt-dlp");
        this.timeout = config.get("ytdlpTimeout", 30000);

        // Prefer WebM/Opus (format 251) for direct streaming — no ffmpeg needed.
        // Fall back to any WebM audio, then best available.
        this.audioFormat = config.get("audioFormat", "251/bestaudio[ext=webm]/bestaudio");

        // Performance flags
        this.socketTimeout = config.get("socketTimeout", 10);
        this.extractorRetries = config.get("extractorRetries", 2);
    }

    /**
     * Resolve input string — direct URL or ytsearch prefix
     * @param {string} query
     * @returns {string}
     */
    resolveInput(query) {
        return YOUTUBE_URL_REGEX.test(query) ? query : `ytsearch1:${query}`;
    }

    /**
     * Common yt-dlp performance flags shared by all invocations
     * @returns {string[]}
     */
    commonFlags() {
        return [
            "--no-update",                          // Never check for updates (saves ~200-500ms)
            "--no-playlist",                        // Never expand playlists
            "--no-check-certificate",               // Skip SSL handshake overhead
            "--no-cache-dir",                       // Skip disk cache I/O
            "--socket-timeout", String(this.socketTimeout),
            "--extractor-retries", String(this.extractorRetries),
            "--extractor-args", "youtube:skip=dash,hls", // Skip DASH/HLS format enumeration
            "--no-warnings",
            "--quiet",
        ];
    }

    /**
     * Get metadata for a search query or URL.
     * Also returns the direct stream URL so callers can avoid a second yt-dlp spawn.
     * @param {string} query - Search query or YouTube URL
     * @returns {Promise<Object>} Metadata object (includes streamUrl)
     */
    async getMetadata(query) {
        const input = this.resolveInput(query);

        return new Promise((resolve, reject) => {
            const args = [
                "-j",               // Dump JSON, no download (--skip-download is redundant with -j)
                "-f", this.audioFormat,
                ...this.commonFlags(),
                "--no-write-thumbnail",
                "--no-write-description",
                "--no-write-info-json",
                input,
            ];

            logger.debug("Spawning yt-dlp for metadata", { query });

            const proc = spawn(this.ytdlpPath, args);
            let output = "";
            let errorOutput = "";

            proc.stdout.on("data", (data) => { output += data.toString(); });
            proc.stderr.on("data", (data) => { errorOutput += data.toString(); });

            const timeoutId = setTimeout(() => {
                logger.warn("yt-dlp metadata timeout", { query });
                proc.kill("SIGTERM");
                reject(new ProviderError("yt-dlp timeout"));
            }, this.timeout);

            proc.on("close", (code) => {
                clearTimeout(timeoutId);

                if (code !== 0) {
                    logger.error("yt-dlp metadata failed", { code, error: errorOutput, query });
                    return reject(new ProviderError(`yt-dlp failed: ${errorOutput}`));
                }

                try {
                    const data = JSON.parse(output);
                    const result = data.entries?.[0] || data;

                    // Attach the best direct stream URL so audio.service can stream
                    // without spawning yt-dlp a second time
                    result.streamUrl = result.url || result.webpage_url;

                    logger.debug("yt-dlp metadata fetched", { query, title: result.title });
                    resolve(result);
                } catch (err) {
                    logger.error("Failed to parse yt-dlp metadata", { error: err.message });
                    reject(new ProviderError("Failed to parse metadata"));
                }
            });

            proc.on("error", (err) => {
                clearTimeout(timeoutId);
                logger.error("yt-dlp spawn error", { error: err.message, query });
                reject(new ProviderError(`yt-dlp spawn error: ${err.message}`));
            });
        });
    }

    /**
     * Get audio stream for a search query or URL.
     * Spawns yt-dlp and pipes stdout directly — used when no pre-fetched URL is available.
     * @param {string} query - Search query or YouTube URL
     * @returns {ReadableStream}
     */
    async getAudioStream(query) {
        const input = this.resolveInput(query);

        const args = [
            "-f", this.audioFormat,
            "--skip-unavailable-fragments",
            "-o", "-",          // Output to stdout
            ...this.commonFlags(),
            input,
        ];

        logger.debug("Spawning yt-dlp for audio stream", { query });

        const proc = spawn(this.ytdlpPath, args);

        // Timeout only covers stream start — not the full duration
        let timeoutId = setTimeout(() => {
            logger.warn("yt-dlp stream start timeout", { query });
            proc.kill("SIGTERM");
        }, this.timeout);

        let streamStarted = false;
        proc.stdout.once("data", () => {
            if (!streamStarted) {
                streamStarted = true;
                clearTimeout(timeoutId);
                logger.debug("yt-dlp stream started", { query });
            }
        });

        proc.on("close", (code) => {
            clearTimeout(timeoutId);
            if (code !== 0 && code !== null) {
                logger.error("yt-dlp stream closed with error", { code, query });
            }
        });

        proc.on("error", (err) => {
            clearTimeout(timeoutId);
            logger.error("yt-dlp stream spawn error", { error: err.message, query });
        });

        let errorOutput = "";
        proc.stderr.on("data", (data) => { errorOutput += data.toString(); });
        proc.stderr.on("end", () => {
            if (errorOutput) logger.debug("yt-dlp stderr", { error: errorOutput, query });
        });

        return proc.stdout;
    }
}

module.exports = YtdlpProvider;
