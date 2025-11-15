/**
 * BaseService
 * 
 * Base class for all services providing common functionality:
 * - Configuration access
 * - Dependency injection
 * - Structured logging with service context
 * - Consistent error handling
 */
const logger = require('../utils/logger');

class BaseService {
    /**
     * Create a new BaseService
     * @param {Object} config - Configuration object
     * @param {Object} dependencies - Dependencies to inject into the service
     */
    constructor(config, dependencies = {}) {
        this.config = config;
        this.dependencies = dependencies;
        this.logger = logger;
    }

    /**
     * Get a dependency by name
     * @param {string} name - Dependency name
     * @returns {Object} The requested dependency
     * @throws {Error} If dependency is not found
     */
    getDependency(name) {
        if (!this.dependencies[name]) {
            throw new Error(`Dependency ${name} not found`);
        }
        return this.dependencies[name];
    }

    /**
     * Log a message with service context
     * @param {string} level - Log level (debug, info, warn, error)
     * @param {string} message - Log message
     * @param {Object} meta - Additional metadata to include in log
     */
    log(level, message, meta = {}) {
        this.logger[level](message, {
            service: this.constructor.name,
            ...meta,
        });
    }

    /**
     * Handle errors consistently
     * @param {Error} error - Error object
     * @param {string} context - Context where error occurred
     * @throws {Error} Re-throws the error after logging
     */
    handleError(error, context) {
        this.log('error', `Error in ${context}`, {
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
}

module.exports = BaseService;
