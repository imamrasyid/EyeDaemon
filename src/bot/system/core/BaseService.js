/**
 * BaseService Class
 * 
 * Base class for all services in the application.
 * Provides common functionality for business logic layer.
 * Services contain business logic separated from controllers.
 */

class BaseService {
    /**
     * Create a new BaseService instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Service configuration options
     */
    constructor(client, options = {}) {
        this.client = client;
        this.options = options;
        this.logger = client.logger || console;
        this.serviceName = this.constructor.name;
    }

    /**
     * Log message with service context
     * @param {string} message - Message to log
     * @param {string} level - Log level (info, warn, error, debug)
     * @param {Object} metadata - Additional metadata to log
     */
    log(message, level = 'info', metadata = {}) {
        const prefix = `[${this.serviceName}]`;
        const logMessage = `${prefix} ${message}`;

        if (this.logger && typeof this.logger[level] === 'function') {
            if (Object.keys(metadata).length > 0) {
                this.logger[level](logMessage, metadata);
            } else {
                this.logger[level](logMessage);
            }
        } else {
            console[level](logMessage, metadata);
        }
    }

    /**
     * Initialize service
     * Override this method in child classes for service-specific initialization
     * @returns {Promise<void>}
     */
    async initialize() {
        this.log('Service initialized', 'debug');
    }

    /**
     * Shutdown service and cleanup resources
     * Override this method in child classes for service-specific cleanup
     * @returns {Promise<void>}
     */
    async shutdown() {
        this.log('Service shutting down', 'debug');
    }

    /**
     * Handle errors with consistent error handling
     * @param {Error} error - Error object
     * @param {string} context - Context where error occurred
     * @param {Object} metadata - Additional error metadata
     * @returns {Error} The error object for rethrowing if needed
     */
    handleError(error, context = '', metadata = {}) {
        const errorMessage = context
            ? `Error in ${context}: ${error.message}`
            : `Error: ${error.message}`;

        this.log(errorMessage, 'error', {
            ...metadata,
            error: error.message,
            stack: error.stack,
        });

        return error;
    }

    /**
     * Retry a function with exponential backoff
     * @param {Function} fn - Async function to retry
     * @param {number} maxRetries - Maximum number of retries (default: 3)
     * @param {number} baseDelay - Base delay in milliseconds (default: 1000)
     * @returns {Promise<any>} Result of the function
     */
    async retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                const isLastAttempt = attempt === maxRetries - 1;

                if (isLastAttempt) {
                    this.log(
                        `Failed after ${maxRetries} attempts`,
                        'error',
                        { error: error.message }
                    );
                    throw error;
                }

                const delay = baseDelay * Math.pow(2, attempt);
                this.log(
                    `Attempt ${attempt + 1} failed, retrying in ${delay}ms`,
                    'warn',
                    { error: error.message }
                );

                await this.sleep(delay);
            }
        }
    }

    /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get database connection from client
     * @returns {Object|null} Database connection or null
     */
    getDatabase() {
        if (this.client && this.client.database) {
            return this.client.database;
        }
        return null;
    }

    /**
     * Execute a database query with error handling
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<Array>} Query results
     */
    async query(sql, params = []) {
        const db = this.getDatabase();

        if (!db) {
            throw new Error('Database connection not available');
        }

        try {
            return await db.query(sql, params);
        } catch (error) {
            this.handleError(error, 'database query', { sql, params });
            throw error;
        }
    }

    /**
     * Validate required parameters
     * @param {Object} params - Parameters to validate
     * @param {Array<string>} required - Required parameter names
     * @throws {Error} If required parameters are missing
     */
    validateRequired(params, required) {
        const missing = required.filter(key => params[key] === undefined || params[key] === null);

        if (missing.length > 0) {
            throw new Error(`Missing required parameters: ${missing.join(', ')}`);
        }
    }

    /**
     * Get guild from client
     * @param {string} guildId - Guild ID
     * @returns {Object|null} Guild object or null
     */
    getGuild(guildId) {
        if (!this.client || !this.client.guilds) {
            return null;
        }
        return this.client.guilds.cache.get(guildId) || null;
    }

    /**
     * Get guild state
     * @param {string} guildId - Guild ID
     * @returns {Object|null} Guild state or null
     */
    getGuildState(guildId) {
        if (!this.client || !this.client.guildStates) {
            return null;
        }
        return this.client.guildStates.get(guildId) || null;
    }

    /**
     * Set guild state
     * @param {string} guildId - Guild ID
     * @param {Object} state - State object to set
     */
    setGuildState(guildId, state) {
        if (!this.client.guildStates) {
            this.client.guildStates = new Map();
        }
        this.client.guildStates.set(guildId, state);
    }
}

module.exports = BaseService;
