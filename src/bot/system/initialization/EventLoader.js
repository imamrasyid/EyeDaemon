/**
 * EventLoader
 * 
 * Handles loading of Discord event handlers using EventManager.
 */

const logger = require('../helpers/LoggerHelper');
const path = require('path');

class EventLoader {
    /**
     * Create a new EventLoader instance
     * @param {Object} bot - Bot instance
     */
    constructor(bot) {
        this.bot = bot;
    }

    /**
     * Load Discord event handlers using EventManager
     * @returns {Promise<void>}
     */
    async loadEvents() {
        try {
            const eventsPath = path.join(__dirname, '../../application/events');

            await this.bot.eventManager.loadEvents(eventsPath);

            logger.info('Event handlers loaded successfully');
        } catch (error) {
            logger.error('Failed to load event handlers', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }
}

module.exports = EventLoader;
