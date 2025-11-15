const { spawn } = require("child_process");
const { ProviderError } = require("../utils/errors");
const logger = require("../utils/logger");

/**
 * YtdlpProvider - Wrapper for yt-dlp operations
 * Handles metadata fetching and audio stream extraction from YouTube
 */
class YtdlpProvider {
    constructor(config) {
        this.config = config;
        this.ytdlpPath = config.get("ytdlpPath", "yt-dlp");
        this.timeout = config.get("ytdlpTimeout", 30000); // Reduced to 30s for faster failures

        // Optimized audio format preferences (quality vs speed)
        // 251: WebM Opus 160kbps (best quality, small size)
        // 140: M4A AAC 128kbps (good quality, widely compatible)
        // bestaudio: fallback
        this.audioFormat = config.get("audioFormat", "251/140/bestaudio[ext=m4a]/bestaudio");

        // Performance optimization flags
        this.socketTimeout = config.get("socketTimeout", 10); // 10 seconds
        this.extractorRetries = config.get("extractorRetries", 3);
    }

    /**
     * Get metadata for a search query or URL
     * @param {string} query - Search query or YouTube URL
     * @returns {Promise<Object>} Metadata object
     */
    async getMetadata(query) {
        const input = `ytsearch1:${query}`;

        return new Promise((resolve, reject) => {
            const args = [
                "-j", // JSON output
                "--no-playlist", // Skip playlist processing (CRITICAL for speed)
                "--flat-playlist", // Don't extract playlist info
                "--no-warnings",
                "--quiet",
                "--skip-download", // Only get metadata
                "-f", this.audioFormat, // Use optimized format
                "--socket-timeout", String(this.socketTimeout), // Fast timeout
                "--extractor-retries", String(this.extractorRetries), // Limited retries
                "--no-check-certificate", // Skip SSL verification (faster)
                "--skip-unavailable-fragments", // Skip broken fragments
                "--no-write-thumbnail", // Don't download thumbnail
                "--no-write-description", // Don't write description file
                "--no-write-info-json", // Don't write info json file
                input,
            ];

            logger.debug("Spawning yt-dlp for metadata", { query, args });

            const process = spawn(this.ytdlpPath, args);

            let output = "";
            let errorOutput = "";

            process.stdout.on("data", (data) => {
                output += data.toString();
            });

            process.stderr.on("data", (data) => {
                errorOutput += data.toString();
            });

            const timeoutId = setTimeout(() => {
                logger.warn("yt-dlp metadata timeout", { query });
                process.kill("SIGTERM");
                reject(new ProviderError("yt-dlp timeout"));
            }, this.timeout);

            process.on("close", (code) => {
                clearTimeout(timeoutId);

                if (code !== 0) {
                    logger.error("yt-dlp failed", { code, error: errorOutput, query });
                    return reject(new ProviderError(`yt-dlp failed: ${errorOutput}`));
                }

                try {
                    const data = JSON.parse(output);
                    const result = data.entries?.[0] || data;
                    logger.debug("yt-dlp metadata fetched", { query, title: result.title });
                    resolve(result);
                } catch (error) {
                    logger.error("Failed to parse yt-dlp metadata", { error: error.message, output });
                    reject(new ProviderError("Failed to parse metadata"));
                }
            });

            process.on("error", (error) => {
                clearTimeout(timeoutId);
                logger.error("yt-dlp spawn error", { error: error.message, query });
                reject(new ProviderError(`yt-dlp spawn error: ${error.message}`));
            });
        });
    }

    /**
     * Get audio stream for a search query or URL
     * @param {string} query - Search query or YouTube URL
     * @returns {ReadableStream} Audio stream
     */
    async getAudioStream(query) {
        const input = `ytsearch1:${query}`;

        const args = [
            "-f", this.audioFormat, // Use optimized format (high quality, fast)
            "--no-cache-dir", // Don't use cache
            "--no-playlist", // Skip playlist processing
            "--socket-timeout", String(this.socketTimeout), // Fast timeout
            "--extractor-retries", String(this.extractorRetries), // Limited retries
            "--no-check-certificate", // Skip SSL verification
            "--skip-unavailable-fragments", // Skip broken fragments
            "-o", "-", // Output to stdout
            "--quiet",
            "--no-warnings",
            input,
        ];

        logger.debug("Spawning yt-dlp for audio stream", { query, args });

        const process = spawn(this.ytdlpPath, args);

        // Setup initial timeout (only for stream start, not entire duration)
        let timeoutId = setTimeout(() => {
            logger.warn("yt-dlp stream failed to start within timeout", { query, timeout: this.timeout });
            process.kill("SIGTERM");
        }, this.timeout);

        // Clear timeout once stream starts flowing
        let streamStarted = false;
        process.stdout.once("data", () => {
            if (!streamStarted) {
                streamStarted = true;
                clearTimeout(timeoutId);
                logger.debug("yt-dlp stream started successfully", { query });
            }
        });

        process.on("close", (code) => {
            clearTimeout(timeoutId);
            if (code !== 0 && code !== null) {
                logger.error("yt-dlp stream process closed with error", { code, query });
            } else if (streamStarted) {
                logger.debug("yt-dlp stream completed", { query });
            }
        });

        process.on("error", (error) => {
            clearTimeout(timeoutId);
            logger.error("yt-dlp stream spawn error", { error: error.message, query });
        });

        // Log stderr for debugging
        let errorOutput = "";
        process.stderr.on("data", (data) => {
            errorOutput += data.toString();
        });

        process.stderr.on("end", () => {
            if (errorOutput) {
                logger.debug("yt-dlp stderr output", { error: errorOutput, query });
            }
        });

        return process.stdout;
    }
}

module.exports = YtdlpProvider;
