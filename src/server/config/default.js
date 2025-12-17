/**
 * Default Configuration
 * Base configuration with fallback values
 */

const resolvedPort = parseInt(process.env.AUDIO_SOURCE_PORT || process.env.PORT, 10);

module.exports = {
    // Server
    port: Number.isInteger(resolvedPort) ? resolvedPort : 3000,
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development',

    // FFmpeg
    ffmpegPath: process.env.FFMPEG_PATH || require('ffmpeg-static'),

    // yt-dlp
    ytdlpPath: process.env.YTDLP_PATH || 'yt-dlp',
    ytdlpTimeout: parseInt(process.env.YTDLP_TIMEOUT) || 30000, // Reduced to 30s for faster failures
    audioFormat: process.env.YTDLP_AUDIO_FORMAT || '251/140/bestaudio[ext=m4a]/bestaudio',
    socketTimeout: parseInt(process.env.YTDLP_SOCKET_TIMEOUT) || 10, // 10 seconds
    extractorRetries: parseInt(process.env.YTDLP_EXTRACTOR_RETRIES) || 3,

    // Cache
    cache: {
        enabled: process.env.CACHE_ENABLED !== 'false',
        ttl: parseInt(process.env.CACHE_TTL) || 600000, // 10 minutes
        maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000,
    },

    // Rate limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // requests per window
    },

    // Timeouts
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 120000, // 2 minutes
    streamTimeout: parseInt(process.env.STREAM_TIMEOUT) || 300000, // 5 minutes

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'json',
        file: {
            enabled: process.env.LOG_FILE_ENABLED === 'true',
            path: process.env.LOG_FILE_PATH || 'logs/server.log',
        },
    },

    // Security
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: process.env.CORS_CREDENTIALS
            ? process.env.CORS_CREDENTIALS === 'true'
            : true,
    },
};
