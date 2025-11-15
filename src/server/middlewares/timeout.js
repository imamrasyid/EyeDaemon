const { TimeoutError } = require('../utils/errors');

/**
 * Request timeout middleware factory
 * Creates middleware that enforces a timeout on requests
 * 
 * @param {number} ms - Timeout duration in milliseconds
 * @returns {Function} Express middleware function
 */
function timeout(ms) {
    return (req, res, next) => {
        // Set timeout for the request
        const timeoutId = setTimeout(() => {
            // Only trigger timeout if response hasn't been sent
            if (!res.headersSent) {
                next(new TimeoutError(`Request timeout after ${ms}ms`));
            }
        }, ms);

        // Clear timeout when response finishes
        res.on('finish', () => {
            clearTimeout(timeoutId);
        });

        // Clear timeout when connection closes
        res.on('close', () => {
            clearTimeout(timeoutId);
        });

        next();
    };
}

module.exports = timeout;
