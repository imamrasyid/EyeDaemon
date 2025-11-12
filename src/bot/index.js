const EyeDaemonClient = require('./EyeDaemonClient');
const { system: logger } = require('./services/logging.service');

/**
 * EyeDaemon Bot - Main entry point
 */
async function main() {
  try {
    logger.info('Starting EyeDaemon Bot');
    
    // Create bot client
    const client = new EyeDaemonClient();
    
    // Handle process errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { 
        error: error.message,
        stack: error.stack 
      });
      
      // Attempt graceful shutdown
      if (client && client.shutdown) {
        client.shutdown().finally(() => {
          process.exit(1);
        });
      } else {
        process.exit(1);
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { 
        reason: reason?.message || reason,
        stack: reason?.stack 
      });
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down gracefully');
      if (client && client.shutdown) {
        client.shutdown().finally(() => {
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down gracefully');
      if (client && client.shutdown) {
        client.shutdown().finally(() => {
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });

    // Initialize and start the bot
    await client.initialize();
    
    // Keep the process alive
    process.stdin.resume();
    
  } catch (error) {
    logger.error('Failed to start EyeDaemon Bot', { 
      error: error.message,
      stack: error.stack 
    });
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main().catch((error) => {
    logger.error('Fatal error in main function', { 
      error: error.message,
      stack: error.stack 
    });
    process.exit(1);
  });
}

module.exports = { main };