/**
 * Error Handler Helper
 * 
 * Provides centralized error handling utilities for consistent error responses
 */

const { formatErrorForUser, logError } = require('../core/Errors');
const logger = require('./logger_helper');
const { replyEphemeral } = require('./interaction_helper');

/**
 * Handle command error
 * Logs error and sends user-friendly message to interaction
 * @param {Error} error - The error that occurred
 * @param {Interaction} interaction - The Discord interaction
 * @param {Object} context - Additional context for logging
 */
async function handleCommandError(error, interaction, context = {}) {
    // Log the error with context
    logError(error, {
        command: interaction.commandName,
        user: interaction.user.tag,
        guild: interaction.guild?.name,
        ...context,
    });

    // Get user-friendly message
    const userMessage = formatErrorForUser(error);

    // Send error message to user
    try {
        await replyEphemeral(interaction, userMessage);
    } catch (replyError) {
        // If we can't reply, log it
        logger.error('Failed to send error message to user', {
            error: replyError.message,
            originalError: error.message,
        });
    }
}

/**
 * Handle interaction error
 * Logs error and sends user-friendly message to interaction
 * @param {Error} error - The error that occurred
 * @param {Interaction} interaction - The Discord interaction
 * @param {Object} context - Additional context for logging
 */
async function handleInteractionError(error, interaction, context = {}) {
    // Log the error with context
    logError(error, {
        customId: interaction.customId,
        type: interaction.type,
        user: interaction.user.tag,
        guild: interaction.guild?.name,
        ...context,
    });

    // Get user-friendly message
    const userMessage = formatErrorForUser(error);

    // Send error message to user
    try {
        await replyEphemeral(interaction, userMessage);
    } catch (replyError) {
        // If we can't reply, try update
        try {
            await interaction.update({
                content: userMessage,
                components: [],
            });
        } catch (updateError) {
            // If we can't update either, log it
            logger.error('Failed to send error message to user', {
                error: updateError.message,
                originalError: error.message,
            });
        }
    }
}

/**
 * Handle event error
 * Logs error without sending message to user
 * @param {Error} error - The error that occurred
 * @param {string} eventName - The event name
 * @param {Object} context - Additional context for logging
 */
function handleEventError(error, eventName, context = {}) {
    // Log the error with context
    logError(error, {
        event: eventName,
        ...context,
    });
}

/**
 * Handle service error
 * Logs error and optionally rethrows
 * @param {Error} error - The error that occurred
 * @param {string} serviceName - The service name
 * @param {string} methodName - The method name
 * @param {Object} context - Additional context for logging
 * @param {boolean} rethrow - Whether to rethrow the error
 */
function handleServiceError(error, serviceName, methodName, context = {}, rethrow = true) {
    // Log the error with context
    logError(error, {
        service: serviceName,
        method: methodName,
        ...context,
    });

    // Rethrow if requested
    if (rethrow) {
        throw error;
    }
}

/**
 * Wrap async function with error handling
 * @param {Function} fn - The async function to wrap
 * @param {Function} errorHandler - The error handler function
 * @returns {Function} Wrapped function
 */
function wrapWithErrorHandler(fn, errorHandler) {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            return errorHandler(error, ...args);
        }
    };
}

/**
 * Create safe async function that catches and logs errors
 * @param {Function} fn - The async function to make safe
 * @param {string} context - Context for error logging
 * @returns {Function} Safe function that won't throw
 */
function createSafeAsync(fn, context = 'unknown') {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            logger.error(`Error in ${context}`, {
                error: error.message,
                stack: error.stack,
            });
            return null;
        }
    };
}

module.exports = {
    handleCommandError,
    handleInteractionError,
    handleEventError,
    handleServiceError,
    wrapWithErrorHandler,
    createSafeAsync,
};
