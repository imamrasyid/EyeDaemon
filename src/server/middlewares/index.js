/**
 * Middleware exports
 * Central export point for all middleware functions
 */

const errorHandler = require('./error-handler');
const requestLogger = require('./request-logger');
const validate = require('./validator');
const createRateLimiter = require('./rate-limiter');
const timeout = require('./timeout');
const asyncHandler = require('./async-handler');

module.exports = {
    errorHandler,
    requestLogger,
    validate,
    createRateLimiter,
    timeout,
    asyncHandler,
};
