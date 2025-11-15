/**
 * Retry Helper
 * 
 * Provides retry logic with exponential backoff for handling transient failures
 */

const logger = require('./logger_helper');

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - The async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 30000)
 * @param {number} options.backoffMultiplier - Backoff multiplier (default: 2)
 * @param {Function} options.shouldRetry - Function to determine if error should be retried
 * @param {Function} options.onRetry - Callback called before each retry
 * @returns {Promise<any>} The result of the function
 * @throws {Error} The last error if all retries fail
 */
async function retryWithBackoff(fn, options = {}) {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 30000,
        backoffMultiplier = 2,
        shouldRetry = () => true,
        onRetry = null,
    } = options;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Try to execute the function
            return await fn();
        } catch (error) {
            lastError = error;

            // If this was the last attempt, throw the error
            if (attempt === maxRetries) {
                logger.error(`All ${maxRetries + 1} attempts failed`, {
                    error: error.message,
                    stack: error.stack,
                });
                throw error;
            }

            // Check if we should retry this error
            if (!shouldRetry(error)) {
                logger.error('Error is not retryable', {
                    error: error.message,
                });
                throw error;
            }

            // Log retry attempt
            logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
                error: error.message,
                attemptsRemaining: maxRetries - attempt,
            });

            // Call onRetry callback if provided
            if (onRetry) {
                try {
                    await onRetry(error, attempt);
                } catch (callbackError) {
                    logger.error('onRetry callback failed', {
                        error: callbackError.message,
                    });
                }
            }

            // Wait before retrying
            await sleep(delay);

            // Calculate next delay with exponential backoff
            delay = Math.min(delay * backoffMultiplier, maxDelay);
        }
    }

    // This should never be reached, but just in case
    throw lastError;
}

/**
 * Retry a function with linear backoff
 * @param {Function} fn - The async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.delay - Delay between retries in ms (default: 1000)
 * @param {Function} options.shouldRetry - Function to determine if error should be retried
 * @param {Function} options.onRetry - Callback called before each retry
 * @returns {Promise<any>} The result of the function
 * @throws {Error} The last error if all retries fail
 */
async function retryWithLinearBackoff(fn, options = {}) {
    const {
        maxRetries = 3,
        delay = 1000,
        shouldRetry = () => true,
        onRetry = null,
    } = options;

    return retryWithBackoff(fn, {
        maxRetries,
        initialDelay: delay,
        maxDelay: delay,
        backoffMultiplier: 1,
        shouldRetry,
        onRetry,
    });
}

/**
 * Check if error is a network error that should be retried
 * @param {Error} error - The error to check
 * @returns {boolean} True if error should be retried
 */
function isNetworkError(error) {
    const networkErrorCodes = [
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ENETUNREACH',
        'EAI_AGAIN',
    ];

    const networkErrorMessages = [
        'network',
        'timeout',
        'connection',
        'socket',
        'ECONNRESET',
        'ETIMEDOUT',
    ];

    // Check error code
    if (error.code && networkErrorCodes.includes(error.code)) {
        return true;
    }

    // Check error message
    const message = error.message?.toLowerCase() || '';
    return networkErrorMessages.some(keyword => message.includes(keyword));
}

/**
 * Check if error is a rate limit error
 * @param {Error} error - The error to check
 * @returns {boolean} True if error is rate limit
 */
function isRateLimitError(error) {
    // Check for Discord rate limit
    if (error.code === 429 || error.httpStatus === 429) {
        return true;
    }

    // Check error message
    const message = error.message?.toLowerCase() || '';
    return message.includes('rate limit') || message.includes('too many requests');
}

/**
 * Check if error is a database busy error
 * @param {Error} error - The error to check
 * @returns {boolean} True if error is database busy
 */
function isDatabaseBusyError(error) {
    const message = error.message?.toLowerCase() || '';
    return message.includes('sqlite_busy') ||
        message.includes('database is locked') ||
        message.includes('database busy');
}

/**
 * Check if error should be retried
 * @param {Error} error - The error to check
 * @returns {boolean} True if error should be retried
 */
function shouldRetryError(error) {
    return isNetworkError(error) ||
        isRateLimitError(error) ||
        isDatabaseBusyError(error);
}

/**
 * Get retry delay from rate limit error
 * @param {Error} error - The rate limit error
 * @returns {number} Delay in milliseconds
 */
function getRateLimitDelay(error) {
    // Try to get retry-after from error
    if (error.retryAfter) {
        return error.retryAfter * 1000;
    }

    // Default to 5 seconds
    return 5000;
}

module.exports = {
    retryWithBackoff,
    retryWithLinearBackoff,
    isNetworkError,
    isRateLimitError,
    isDatabaseBusyError,
    shouldRetryError,
    getRateLimitDelay,
    sleep,
};
