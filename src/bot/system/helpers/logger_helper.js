/**
 * Logger Helper
 * 
 * Simple logging utility for the bot
 */

const chalk = require('chalk');

/**
 * Log levels
 */
const LogLevel = {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG',
};

/**
 * Format timestamp
 */
function getTimestamp() {
    return new Date().toISOString();
}

/**
 * Log info message
 */
function info(message, data = {}) {
    const timestamp = getTimestamp();
    console.log(chalk.blue(`[${timestamp}] [INFO]`), message, data);
}

/**
 * Log warning message
 */
function warn(message, data = {}) {
    const timestamp = getTimestamp();
    console.log(chalk.yellow(`[${timestamp}] [WARN]`), message, data);
}

/**
 * Log error message
 */
function error(message, data = {}) {
    const timestamp = getTimestamp();
    console.error(chalk.red(`[${timestamp}] [ERROR]`), message, data);
}

/**
 * Log debug message
 */
function debug(message, data = {}) {
    const timestamp = getTimestamp();
    console.log(chalk.gray(`[${timestamp}] [DEBUG]`), message, data);
}

/**
 * Create logger instance
 */
const logger = {
    info,
    warn,
    error,
    debug,
    LogLevel,
};

module.exports = logger;
