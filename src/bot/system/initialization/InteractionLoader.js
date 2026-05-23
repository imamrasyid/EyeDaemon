/**
 * InteractionLoader
 * 
 * Handles loading of interaction handlers using InteractionManager.
 */

const logger = require('../helpers/LoggerHelper');

class InteractionLoader {
    /**
     * Create a new InteractionLoader instance
     * @param {Object} bot - Bot instance
     */
    constructor(bot) {
        this.bot = bot;
    }

    /**
     * Load interaction handlers using InteractionManager
     * @returns {Promise<void>}
     */
    async loadInteractions() {
        try {
            await this.bot.interactionManager.loadInteractions();

            logger.info('Interaction handlers loaded successfully');
        } catch (error) {
            logger.error('Failed to load interaction handlers', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }
}

module.exports = InteractionLoader;
