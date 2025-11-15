/**
 * Rate Limit Helper
 * 
 * Provides utilities for handling Discord API rate limits
 */

const logger = require('./logger_helper');
const { sleep, getRateLimitDelay } = require('./retry_helper');

/**
 * Rate limit bucket tracker
 * Tracks rate limit state per route
 */
class RateLimitTracker {
    constructor() {
        this.buckets = new Map();
    }

    /**
     * Check if route is rate limited
     * @param {string} route - The route identifier
     * @returns {boolean} True if rate limited
     */
    isRateLimited(route) {
        const bucket = this.buckets.get(route);
        if (!bucket) return false;

        return bucket.resetAt > Date.now();
    }

    /**
     * Get time until rate limit reset
     * @param {string} route - The route identifier
     * @returns {number} Milliseconds until reset, or 0 if not rate limited
     */
    getResetTime(route) {
        const bucket = this.buckets.get(route);
        if (!bucket) return 0;

        const remaining = bucket.resetAt - Date.now();
        return Math.max(0, remaining);
    }

    /**
     * Set rate limit for route
     * @param {string} route - The route identifier
     * @param {number} resetAfter - Milliseconds until reset
     */
    setRateLimit(route, resetAfter) {
        this.buckets.set(route, {
            resetAt: Date.now() + resetAfter,
        });

        logger.warn(`Rate limit set for route: ${route}`, {
            resetAfter,
            resetAt: new Date(Date.now() + resetAfter).toISOString(),
        });

        // Auto-cleanup after reset
        setTimeout(() => {
            this.buckets.delete(route);
        }, resetAfter);
    }

    /**
     * Clear rate limit for route
     * @param {string} route - The route identifier
     */
    clearRateLimit(route) {
        this.buckets.delete(route);
    }

    /**
     * Clear all rate limits
     */
    clearAll() {
        this.buckets.clear();
    }
}

// Global rate limit tracker
const rateLimitTracker = new RateLimitTracker();

/**
 * Handle rate limit error
 * @param {Error} error - The rate limit error
 * @param {string} route - The route identifier
 * @returns {Promise<void>}
 */
async function handleRateLimit(error, route = 'unknown') {
    // Get retry-after time
    const retryAfter = getRateLimitDelay(error);

    logger.warn('Rate limit hit', {
        route,
        retryAfter,
        error: error.message,
    });

    // Set rate limit in tracker
    rateLimitTracker.setRateLimit(route, retryAfter);

    // Wait for rate limit to reset
    await sleep(retryAfter);
}

/**
 * Execute function with rate limit handling
 * @param {Function} fn - The async function to execute
 * @param {Object} options - Options
 * @param {string} options.route - Route identifier for rate limit tracking
 * @param {number} options.maxRetries - Maximum retries for rate limits (default: 3)
 * @returns {Promise<any>} The result of the function
 */
async function executeWithRateLimit(fn, options = {}) {
    const {
        route = 'unknown',
        maxRetries = 3,
    } = options;

    let retries = 0;

    while (retries <= maxRetries) {
        try {
            // Check if route is currently rate limited
            if (rateLimitTracker.isRateLimited(route)) {
                const resetTime = rateLimitTracker.getResetTime(route);
                logger.info(`Waiting for rate limit to reset on route: ${route}`, {
                    resetTime,
                });
                await sleep(resetTime);
            }

            // Execute function
            return await fn();
        } catch (error) {
            // Check if it's a rate limit error
            if (error.code === 429 || error.httpStatus === 429) {
                if (retries >= maxRetries) {
                    logger.error('Max rate limit retries exceeded', {
                        route,
                        retries,
                    });
                    throw error;
                }

                // Handle rate limit
                await handleRateLimit(error, route);
                retries++;
            } else {
                // Not a rate limit error, rethrow
                throw error;
            }
        }
    }
}

/**
 * Create rate-limited function wrapper
 * @param {Function} fn - The function to wrap
 * @param {string} route - Route identifier
 * @returns {Function} Wrapped function
 */
function createRateLimitedFunction(fn, route) {
    return async (...args) => {
        return executeWithRateLimit(() => fn(...args), { route });
    };
}

/**
 * Wait for rate limit to reset
 * @param {string} route - The route identifier
 * @returns {Promise<void>}
 */
async function waitForRateLimit(route) {
    if (rateLimitTracker.isRateLimited(route)) {
        const resetTime = rateLimitTracker.getResetTime(route);
        logger.info(`Waiting for rate limit reset: ${route}`, {
            resetTime,
        });
        await sleep(resetTime);
    }
}

/**
 * Check if error is a rate limit error
 * @param {Error} error - The error to check
 * @returns {boolean} True if rate limit error
 */
function isRateLimitError(error) {
    return error.code === 429 ||
        error.httpStatus === 429 ||
        error.message?.toLowerCase().includes('rate limit');
}

/**
 * Get rate limit info from error
 * @param {Error} error - The rate limit error
 * @returns {Object} Rate limit info
 */
function getRateLimitInfo(error) {
    return {
        retryAfter: error.retryAfter || 5000,
        global: error.global || false,
        limit: error.limit,
        remaining: error.remaining,
        resetAt: error.resetAt,
    };
}

module.exports = {
    RateLimitTracker,
    rateLimitTracker,
    handleRateLimit,
    executeWithRateLimit,
    createRateLimitedFunction,
    waitForRateLimit,
    isRateLimitError,
    getRateLimitInfo,
};
