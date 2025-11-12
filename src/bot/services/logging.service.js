const pino = require('pino');
const path = require('path');
const fs = require('fs');
const CONFIG = require('../config');

// Ensure logs directory exists
const logsDir = path.dirname(CONFIG.LOGGING.FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create logger configuration
const loggerConfig = {
  level: CONFIG.LOGGING.LEVEL,
  transport: CONFIG.LOGGING.PRETTY ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      messageFormat: '{msg}'
    }
  } : undefined,
  
  // File logging configuration
  targets: [
    {
      target: 'pino/file',
      level: CONFIG.LOGGING.LEVEL,
      options: {
        destination: CONFIG.LOGGING.FILE,
        mkdir: true,
        append: true
      }
    }
  ]
};

// Create logger instance
const logger = pino(loggerConfig);

// Custom log levels with context
const logLevels = {
  error: (message, context = {}) => logger.error({ ...context, timestamp: new Date().toISOString() }, message),
  warn: (message, context = {}) => logger.warn({ ...context, timestamp: new Date().toISOString() }, message),
  info: (message, context = {}) => logger.info({ ...context, timestamp: new Date().toISOString() }, message),
  debug: (message, context = {}) => logger.debug({ ...context, timestamp: new Date().toISOString() }, message),
  trace: (message, context = {}) => logger.trace({ ...context, timestamp: new Date().toISOString() }, message)
};

// Specialized loggers for different modules
const createModuleLogger = (module) => ({
  error: (message, context = {}) => logLevels.error(`[${module}] ${message}`, context),
  warn: (message, context = {}) => logLevels.warn(`[${module}] ${message}`, context),
  info: (message, context = {}) => logLevels.info(`[${module}] ${message}`, context),
  debug: (message, context = {}) => logLevels.debug(`[${module}] ${message}`, context),
  trace: (message, context = {}) => logLevels.trace(`[${module}] ${message}`, context)
});

// Database query logger
const createQueryLogger = (module) => ({
  query: (query, params = [], duration) => {
    logLevels.debug(`[${module}] Database query executed`, {
      query: query.substring(0, 200), // Truncate long queries
      params,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  },
  error: (query, error, params = []) => {
    logLevels.error(`[${module}] Database query failed`, {
      query: query.substring(0, 200),
      params,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Performance logger
const createPerformanceLogger = (module) => ({
  start: (operation) => {
    const startTime = process.hrtime.bigint();
    return {
      end: () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        logLevels.debug(`[${module}] ${operation} completed`, {
          operation,
          duration: `${duration.toFixed(2)}ms`,
          timestamp: new Date().toISOString()
        });
      },
      error: (error) => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;
        logLevels.error(`[${module}] ${operation} failed`, {
          operation,
          duration: `${duration.toFixed(2)}ms`,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };
  }
});

// Rate limit logger
const createRateLimitLogger = (module) => ({
  hit: (userId, command, resetTime) => {
    logLevels.warn(`[${module}] Rate limit hit`, {
      userId,
      command,
      resetTime: new Date(resetTime).toISOString(),
      timestamp: new Date().toISOString()
    });
  },
  exceeded: (userId, command, attempts) => {
    logLevels.error(`[${module}] Rate limit exceeded`, {
      userId,
      command,
      attempts,
      timestamp: new Date().toISOString()
    });
  }
});

// Security logger
const createSecurityLogger = (module) => ({
  unauthorized: (userId, action, reason) => {
    logLevels.warn(`[${module}] Unauthorized access attempt`, {
      userId,
      action,
      reason,
      timestamp: new Date().toISOString()
    });
  },
  suspicious: (userId, action, details) => {
    logLevels.error(`[${module}] Suspicious activity detected`, {
      userId,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  }
});

// Export main logger and factory functions
module.exports = {
  // Main logger
  logger: logLevels,
  
  // Module logger factory
  createModuleLogger,
  
  // Specialized loggers
  createQueryLogger,
  createPerformanceLogger,
  createRateLimitLogger,
  createSecurityLogger,
  
  // Pre-defined module loggers
  system: createModuleLogger('SYSTEM'),
  database: createModuleLogger('DATABASE'),
  music: createModuleLogger('MUSIC'),
  moderation: createModuleLogger('MODERATION'),
  economy: createModuleLogger('ECONOMY'),
  leveling: createModuleLogger('LEVELING'),
  events: createModuleLogger('EVENTS'),
  commands: createModuleLogger('COMMANDS'),
  interactions: createModuleLogger('INTERACTIONS'),
  permissions: createModuleLogger('PERMISSIONS'),
  rateLimit: createModuleLogger('RATE_LIMIT')
};