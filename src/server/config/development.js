/**
 * Development Configuration
 * Overrides for development environment
 */

module.exports = {
    // Logging
    logging: {
        level: 'debug',
        format: 'pretty',
        file: {
            enabled: false,
        },
    },

    // More verbose errors in development
    showStackTrace: true,
};
