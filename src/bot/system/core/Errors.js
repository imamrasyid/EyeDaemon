/**
 * Error Classes
 * 
 * Custom error classes for different error types in the bot.
 * Provides consistent error handling across the application.
 */

/**
 * Base Bot Error
 * Base class for all bot-specific errors
 */
class BotError extends Error {
    /**
     * Create a new BotError
     * @param {string} message - Error message
     * @param {string} code - Error code
     */
    constructor(message, code = 'BOT_ERROR') {
        super(message);
        this.name = 'BotError';
        this.code = code;
        this.timestamp = new Date();

        // Maintains proper stack trace for where error was thrown
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Convert error to JSON
     * @returns {Object} Error object
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }

    /**
     * Get user-friendly error message
     * @returns {string} User-friendly message
     */
    getUserMessage() {
        return this.message;
    }
}

/**
 * Voice Error
 * Error related to voice connections and voice channel operations
 */
class VoiceError extends BotError {
    /**
     * Create a new VoiceError
     * @param {string} message - Error message
     * @param {Object} context - Additional context (guildId, channelId, etc)
     */
    constructor(message, context = {}) {
        super(message, 'VOICE_ERROR');
        this.name = 'VoiceError';
        this.context = context;
    }

    /**
     * Get user-friendly error message
     * @returns {string} User-friendly message
     */
    getUserMessage() {
        // Provide more user-friendly messages for common voice errors
        if (this.message.includes('permissions')) {
            return 'I don\'t have permission to join or speak in that voice channel.';
        }
        if (this.message.includes('not in voice')) {
            return 'You need to be in a voice channel to use this command.';
        }
        if (this.message.includes('different channel')) {
            return 'You need to be in the same voice channel as me.';
        }
        return this.message;
    }
}

/**
 * Queue Error
 * Error related to music queue operations
 */
class QueueError extends BotError {
    /**
     * Create a new QueueError
     * @param {string} message - Error message
     * @param {Object} context - Additional context (guildId, queueLength, etc)
     */
    constructor(message, context = {}) {
        super(message, 'QUEUE_ERROR');
        this.name = 'QueueError';
        this.context = context;
    }

    /**
     * Get user-friendly error message
     * @returns {string} User-friendly message
     */
    getUserMessage() {
        // Provide more user-friendly messages for common queue errors
        if (this.message.includes('empty')) {
            return 'The queue is empty. Add some tracks first!';
        }
        if (this.message.includes('not found')) {
            return 'Could not find that track in the queue.';
        }
        if (this.message.includes('full')) {
            return 'The queue is full. Please wait for some tracks to finish.';
        }
        return this.message;
    }
}

/**
 * Audio Error
 * Error related to audio playback and streaming
 */
class AudioError extends BotError {
    /**
     * Create a new AudioError
     * @param {string} message - Error message
     * @param {Object} context - Additional context (trackUrl, source, etc)
     */
    constructor(message, context = {}) {
        super(message, 'AUDIO_ERROR');
        this.name = 'AudioError';
        this.context = context;
    }

    /**
     * Get user-friendly error message
     * @returns {string} User-friendly message
     */
    getUserMessage() {
        // Provide more user-friendly messages for common audio errors
        if (this.message.includes('unavailable')) {
            return 'This track is unavailable or has been removed.';
        }
        if (this.message.includes('stream')) {
            return 'Failed to stream audio. The source might be unavailable.';
        }
        if (this.message.includes('format')) {
            return 'This audio format is not supported.';
        }
        return 'Failed to play audio. Please try again.';
    }
}

/**
 * Database Error
 * Error related to database operations
 */
class DatabaseError extends BotError {
    /**
     * Create a new DatabaseError
     * @param {string} message - Error message
     * @param {Object} context - Additional context (query, table, etc)
     */
    constructor(message, context = {}) {
        super(message, 'DATABASE_ERROR');
        this.name = 'DatabaseError';
        this.context = context;
    }

    /**
     * Get user-friendly error message
     * @returns {string} User-friendly message
     */
    getUserMessage() {
        return 'A database error occurred. Please try again later.';
    }
}

/**
 * Permission Error
 * Error related to user or bot permissions
 */
class PermissionError extends BotError {
    /**
     * Create a new PermissionError
     * @param {string} message - Error message
     * @param {Object} context - Additional context (required, missing, etc)
     */
    constructor(message, context = {}) {
        super(message, 'PERMISSION_ERROR');
        this.name = 'PermissionError';
        this.context = context;
    }

    /**
     * Get user-friendly error message
     * @returns {string} User-friendly message
     */
    getUserMessage() {
        if (this.context.required) {
            return `You need the following permission(s): ${this.context.required.join(', ')}`;
        }
        return this.message;
    }
}

/**
 * Validation Error
 * Error related to input validation
 */
class ValidationError extends BotError {
    /**
     * Create a new ValidationError
     * @param {string} message - Error message
     * @param {Object} context - Additional context (field, value, etc)
     */
    constructor(message, context = {}) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
        this.context = context;
    }

    /**
     * Get user-friendly error message
     * @returns {string} User-friendly message
     */
    getUserMessage() {
        return this.message;
    }
}

/**
 * Format error for user display
 * @param {Error} error - The error to format
 * @returns {string} User-friendly error message
 */
function formatErrorForUser(error) {
    // If it's one of our custom errors, use getUserMessage
    if (error instanceof BotError) {
        return error.getUserMessage();
    }

    // Handle Discord.js errors
    if (error.code) {
        switch (error.code) {
            case 50013:
                return '❌ I don\'t have permission to do that.';
            case 50001:
                return '❌ I don\'t have access to that.';
            case 10008:
                return '❌ Message not found.';
            case 10003:
                return '❌ Channel not found.';
            case 50035:
                return '❌ Invalid input provided.';
            case 429:
                return '❌ Rate limited. Please try again in a moment.';
        }
    }

    // Generic error message
    return '❌ An error occurred. Please try again.';
}

/**
 * Log error with context
 * @param {Error} error - The error to log
 * @param {Object} context - Additional context
 */
function logError(error, context = {}) {
    const logger = require('../helpers/logger_helper');

    logger.error(error.message, {
        name: error.name,
        code: error.code,
        stack: error.stack,
        ...context,
    });
}

// Export all error classes and utilities
module.exports = {
    BotError,
    VoiceError,
    QueueError,
    AudioError,
    DatabaseError,
    PermissionError,
    ValidationError,
    formatErrorForUser,
    logError,
};
