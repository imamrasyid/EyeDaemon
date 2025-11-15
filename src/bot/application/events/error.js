/**
 * Error Event Handler
 * 
 * Fired when the Discord client encounters an error.
 * Logs errors for debugging and monitoring.
 */

const BaseEvent = require('../../system/core/BaseEvent');

class ErrorEvent extends BaseEvent {
    constructor(client) {
        super(client, {
            name: 'error',
            once: false,
        });
    }

    async execute(error) {
        this.log('Discord client error', 'error', {
            error: error.message,
            stack: error.stack,
        });
    }

    /**
     * Get error context
     * @param {Array} args - Event arguments
     * @returns {Object} Context object
     */
    getErrorContext(args) {
        const error = args[0];
        return {
            errorMessage: error?.message,
            errorName: error?.name,
        };
    }
}

module.exports = ErrorEvent;
