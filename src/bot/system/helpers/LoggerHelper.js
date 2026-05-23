/**
 * Logger Helper
 * 
 * Simple logging utility for the bot
 */

const chalk = {
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    gray: (text) => `\x1b[90m${text}\x1b[0m`,
};

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
