const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Centralized error handling middleware
 * Handles both operational and programming errors
 * 
 * @param {Error} err - Error object
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, next) {
    // Log error with context
    logger.error('Request error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        query: req.query,
        body: req.body,
        ip: req.ip,
        correlationId: req.correlationId,
        userAgent: req.get('user-agent'),
    });

    // Operational errors (expected errors with proper error handling)
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.message,
            code: err.code,
            ...(err.details && { details: err.details }),
        });
    }

    // Programming errors (unexpected errors)
    logger.error('Unexpected programming error', {
        error: err.message,
        stack: err.stack,
        correlationId: req.correlationId,
    });

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';

    return res.status(500).json({
        success: false,
        error: isDevelopment ? err.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
        ...(isDevelopment && { stack: err.stack }),
    });
}

module.exports = errorHandler;
