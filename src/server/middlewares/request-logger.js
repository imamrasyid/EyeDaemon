const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Request logging middleware
 * Generates correlation IDs and logs request/response details
 * 
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Express next function
 */
function requestLogger(req, res, next) {
    // Generate unique correlation ID for request tracking
    req.correlationId = uuidv4();

    const startTime = Date.now();

    // Log incoming request
    logger.info('Incoming request', {
        correlationId: req.correlationId,
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });

    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - startTime;

        logger.info('Request completed', {
            correlationId: req.correlationId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
        });
    });

    next();
}

module.exports = requestLogger;
