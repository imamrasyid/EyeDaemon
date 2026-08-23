'use strict';

/**
 * EyeDaemon Bot - Unified Runtime Entry Point
 * 
 * Initializes and starts the unified Discord bot with embedded HTTP server
 * and in-process audio streaming.
 */

const Bot = require('./bootstrap');
const logger = require('./system/helpers/LoggerHelper');

/**
 * Main function to start the bot
 */
async function main() {
    try {
        logger.info('Starting EyeDaemon Unified Runtime');

        // Create and initialize bot instance
        const bot = new Bot();
        await bot.init();

        logger.info('EyeDaemon is running');
    } catch (error) {
        logger.error('Failed to start EyeDaemon Bot', {
            error: error.message,
            stack: error.stack,
        });
        process.exit(1);
    }
}

// Run the main function
if (require.main === module) {
    main().catch((error) => {
        logger.error('Fatal error in main function', {
            error: error.message,
            stack: error.stack,
        });
        process.exit(1);
    });
}

module.exports = { main };
