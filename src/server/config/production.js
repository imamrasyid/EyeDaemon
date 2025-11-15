/**
 * Production Configuration
 * Overrides for production environment
 */

module.exports = {
    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: 'json',
        file: {
            enabled: true,
            path: 'logs/server.log',
        },
    },

    // Hide stack traces in production
    showStackTrace: false,

    // Stricter rate limiting in production
    rateLimit: {
        windowMs: 60000,
        max: 50,
    },
};
