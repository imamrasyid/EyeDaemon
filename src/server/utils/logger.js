/**
 * Structured Logger with Winston
 * Provides comprehensive logging with multiple transports and formats
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Lazy load config to avoid circular dependencies
let config;
const getConfig = () => {
    if (!config) {
        config = require('../config');
    }
    return config;
};

// Define log format for JSON output
const jsonFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Console format for development (pretty print)
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}] ${message}`;

        // Add metadata if present
        const metaKeys = Object.keys(meta);
        if (metaKeys.length > 0) {
            // Filter out internal winston properties
            const filteredMeta = {};
            for (const key of metaKeys) {
                if (!['timestamp', 'level', 'message'].includes(key)) {
                    filteredMeta[key] = meta[key];
                }
            }

            if (Object.keys(filteredMeta).length > 0) {
                msg += ` ${JSON.stringify(filteredMeta)}`;
            }
        }

        return msg;
    })
);

// Create transports array
const createTransports = () => {
    const transports = [];
    const cfg = getConfig();

    // Console transport
    const logFormat = cfg.get('logging.format') === 'json' ? jsonFormat : consoleFormat;
    transports.push(
        new winston.transports.Console({
            format: logFormat,
        })
    );

    // File transport (if enabled)
    if (cfg.get('logging.file.enabled')) {
        const logPath = cfg.get('logging.file.path');
        const logDir = path.dirname(logPath);

        // Ensure log directory exists
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        transports.push(
            new winston.transports.File({
                filename: path.join(process.cwd(), logPath),
                format: jsonFormat,
                maxsize: 10485760, // 10MB
                maxFiles: 5,
            })
        );
    }

    return transports;
};

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: jsonFormat,
    transports: createTransports(),
    exitOnError: false,
});

// Add convenience methods for structured logging
logger.logWithContext = (level, message, context = {}) => {
    logger[level](message, context);
};

module.exports = logger;
