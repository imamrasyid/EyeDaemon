/**
 * Warn Event Handler
 * 
 * Fired when the Discord client encounters a warning.
 * Logs warnings for debugging and monitoring.
 */

const BaseEvent = require('../../system/core/BaseEvent');

class WarnEvent extends BaseEvent {
    constructor(client) {
        super(client, {
            name: 'warn',
            once: false,
        });
    }

    async execute(warning) {
        this.log('Discord client warning', 'warn', { warning });
    }

    /**
     * Get error context
     * @param {Array} args - Event arguments
     * @returns {Object} Context object
     */
    getErrorContext(args) {
        return {
            warning: args[0],
        };
    }
}

module.exports = WarnEvent;
