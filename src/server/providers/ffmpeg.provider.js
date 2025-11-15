const { spawn } = require("child_process");
const { ProviderError } = require("../utils/errors");
const logger = require("../utils/logger");

/**
 * FfmpegProvider - Wrapper for ffmpeg audio processing operations
 * Handles audio filtering, format conversion, and stream processing
 */
class FfmpegProvider {
    constructor(config) {
        this.config = config;
        this.ffmpegPath = config.get("ffmpegPath");
    }

    /**
     * Process audio stream with optional filters and seek
     * @param {Object} options - Processing options
     * @param {ReadableStream} options.inputStream - Input audio stream
     * @param {number} options.start - Start position in seconds
     * @param {string} options.filter - Audio filter preset
     * @param {string} options.format - Output format (webm, mp3)
     * @returns {ReadableStream} Processed audio stream
     */
    async processAudio({
        inputStream,
        start = 0,
        filter = "none",
        format = "webm",
    }) {
        const args = [
            "-loglevel",
            "error",
            "-hide_banner",
            "-nostats",
            ...(start > 0 ? ["-ss", String(start)] : []),
            "-i",
            "pipe:0",
            ...this.buildFilterArgs(filter),
            "-f",
            format,
            "-acodec",
            format === "mp3" ? "libmp3lame" : "libopus",
            "-b:a",
            "128k",
            "pipe:1",
        ];

        logger.debug("Spawning ffmpeg for audio processing", {
            start,
            filter,
            format,
            args,
        });

        const process = spawn(this.ffmpegPath, args);

        // Pipe input to ffmpeg
        inputStream.pipe(process.stdin);

        // Handle input stream errors
        inputStream.on("error", (error) => {
            logger.error("Input stream error", { error: error.message });
            if (!process.stdin.destroyed) {
                process.stdin.destroy();
            }
        });

        // Handle errors
        let errorOutput = "";
        process.stderr.on("data", (data) => {
            errorOutput += data.toString();
        });

        process.on("error", (error) => {
            logger.error("ffmpeg spawn error", { error: error.message, filter });
        });

        process.on("close", (code) => {
            if (code !== 0 && code !== null) {
                logger.error("ffmpeg failed", { code, error: errorOutput, filter });
            } else {
                logger.debug("ffmpeg process completed", { filter, format });
            }
        });

        // Cleanup on stdout errors
        process.stdout.on("error", (error) => {
            logger.error("ffmpeg stdout error", { error: error.message });
            if (!inputStream.destroyed) {
                inputStream.destroy();
            }
        });

        return process.stdout;
    }

    /**
     * Build ffmpeg filter arguments based on preset
     * @param {string} preset - Filter preset name or dynamic filter
     * @returns {Array<string>} ffmpeg arguments for the filter
     */
    buildFilterArgs(preset) {
        if (!preset || preset === "none") {
            return [];
        }

        // Predefined filter presets
        const filters = {
            bassboost: ["-af", "bass=g=10"],
            nightcore: ["-af", "asetrate=48000*1.1,atempo=1.1,aresample=48000"],
            vaporwave: ["-af", "asetrate=44100*0.85,atempo=1,aresample=44100"],
            "8d": ["-af", "apulsator=mode=sine:hz=0.09"],
            karaoke: ["-af", "stereotools=mlev=0.015"],
        };

        if (filters[preset]) {
            logger.debug("Using predefined filter", { preset });
            return filters[preset];
        }

        // Handle dynamic filters
        if (preset.startsWith("pitch:")) {
            const pitchValue = preset.split(":")[1];
            const pitch = Math.max(0.5, Math.min(2, Number(pitchValue) || 1));
            logger.debug("Using dynamic pitch filter", { preset, pitch });
            return ["-af", `asetrate=48000*${pitch},aresample=48000`];
        }

        if (preset.startsWith("speed:")) {
            const speedValue = preset.split(":")[1];
            const speed = Math.max(0.5, Math.min(2, Number(speedValue) || 1));
            logger.debug("Using dynamic speed filter", { preset, speed });
            return ["-af", `atempo=${speed}`];
        }

        logger.warn("Unknown filter preset, using none", { preset });
        return [];
    }
}

module.exports = FfmpegProvider;
