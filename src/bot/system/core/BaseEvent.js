/**
 * BaseEvent Class
 * 
 * Base class for all Discord event handlers.
 * Provides common functionality for handling Discord events in an organized way.
 */

class BaseEvent {
    /**
     * Create a new BaseEvent instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Event configuration options
     * @param {string} options.name - Discord event name (e.g., 'ready', 'messageCreate')
     * @param {boolean} options.once - Whether event should only fire once
     * @param {boolean} options.enabled - Whether event is enabled (default: true)
     */
    constructor(client, options = {}) {
        this.client = client;
        this.name = options.name;
        this.once = options.once || false;
        this.enabled = options.enabled !== undefined ? options.enabled : true;
        this.logger = client.logger || console;
        this.eventName = this.constructor.name;
    }

    /**
     * Execute the event handler
     * Override this method in child classes to implement event logic
     * @param {...any} args - Event arguments from Discord.js
     * @returns {Promise<void>}
     */
    async execute(...args) {
        throw new Error(`execute() method must be implemented in ${this.eventName}`);
    }

    /**
     * Handle errors that occur during event execution
     * @param {Error} error - Error object
     * @param {...any} args - Event arguments for context
     * @returns {Promise<void>}
     */
    async handleError(error, ...args) {
        const context = this.getErrorContext(args);

        this.log(
            `Error handling event: ${error.message}`,
            'error',
            {
                event: this.name,
                error: error.message,
                stack: error.stack,
                ...context,
            }
        );

        // Emit error event for centralized error handling
        if (this.client && this.client.emit) {
            this.client.emit('eventError', {
                event: this.name,
                error,
                args,
            });
        }
    }

    /**
     * Get error context from event arguments
     * Override this method in child classes for event-specific context
     * @param {Array} args - Event arguments
     * @returns {Object} Context object
     */
    getErrorContext(args) {
        const context = {};

        // Try to extract common context from args
        if (args.length > 0) {
            const firstArg = args[0];

            // Guild context
            if (firstArg?.guild) {
                context.guild = firstArg.guild.name;
                context.guildId = firstArg.guild.id;
            }

            // User context
            if (firstArg?.user) {
                context.user = firstArg.user.tag;
                context.userId = firstArg.user.id;
            } else if (firstArg?.author) {
                context.user = firstArg.author.tag;
                context.userId = firstArg.author.id;
            }

            // Channel context
            if (firstArg?.channel) {
                context.channelId = firstArg.channel.id;
            }
        }

        return context;
    }

    /**
     * Log message with event context
     * @param {string} message - Message to log
     * @param {string} level - Log level (info, warn, error, debug)
     * @param {Object} metadata - Additional metadata to log
     */
    log(message, level = 'info', metadata = {}) {
        const prefix = `[${this.eventName}]`;
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
     * Check if event is enabled
     * @returns {boolean} True if event is enabled
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Enable the event
     */
    enable() {
        this.enabled = true;
        this.log(`Event enabled: ${this.name}`, 'debug');
    }

    /**
     * Disable the event
     */
    disable() {
        this.enabled = false;
        this.log(`Event disabled: ${this.name}`, 'debug');
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
            this.log(
                `Database query error: ${error.message}`,
                'error',
                { sql, params, error: error.message }
            );
            throw error;
        }
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

    /**
     * Clear guild state
     * @param {string} guildId - Guild ID
     */
    clearGuildState(guildId) {
        if (this.client.guildStates) {
            this.client.guildStates.delete(guildId);
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
}

module.exports = BaseEvent;
