const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Rate limiter middleware factory
 * Creates rate limiting middleware with configurable limits
 * 
 * @param {Object} config - Configuration object
 * @returns {Function} Express rate limiting middleware
 */
function createRateLimiter(config) {
    return rateLimit({
        windowMs: config.get('rateLimit.windowMs', 60000), // Time window in ms (default: 1 minute)
        max: config.get('rateLimit.max', 100),              // Max requests per window (default: 100)

        // Custom error message
        message: {
            success: false,
            error: 'Too many requests, please try again later',
            code: 'RATE_LIMIT_EXCEEDED',
        },

        // Custom handler for rate limit exceeded
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                path: req.path,
                method: req.method,
                correlationId: req.correlationId,
            });

            res.status(429).json({
                success: false,
                error: 'Too many requests, please try again later',
                code: 'RATE_LIMIT_EXCEEDED',
            });
        },

        // Use standard headers (RateLimit-*)
        standardHeaders: true,

        // Disable legacy headers (X-RateLimit-*)
        legacyHeaders: false,

        // Skip successful requests (only count failed requests)
        skipSuccessfulRequests: false,

        // Skip failed requests
        skipFailedRequests: false,
    });
}

module.exports = createRateLimiter;
