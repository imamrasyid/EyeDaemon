/**
 * EyeDaemon Bot - New Bootstrap Entry Point
 * 
 * This is the new entry point using the CodeIgniter-inspired architecture.
 * Uses the Bot class from bootstrap.js to initialize and run the bot.
 */

const Bot = require('./bootstrap');
const logger = require('./system/helpers/logger_helper');
// const { ensureServerRunning } = require('./system/helpers/server_helper');

/**
 * Main function to start the bot
 */
async function main() {
    try {
        logger.info('Starting EyeDaemon Bot');

        // Pastikan audio source server berjalan sebelum bot dimulai
        // await ensureServerRunning();

        // Create and initialize bot instance
        const bot = new Bot();
        await bot.init();

        // Keep the process alive
        process.stdin.resume();

        logger.info('Bot is running');
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
