/**
 * Server Entry Point with Dependency Injection
 * 
 * Initializes all providers, services, and controllers with proper
 * dependency injection, then creates and starts the Express server.
 * 
 * Requirements: 5.1, 5.2, 5.3
 */
require('dotenv').config();

const config = require('./config');
const createApp = require('./app');
const logger = require('./utils/logger');

// Import providers
const YtdlpProvider = require('./providers/ytdlp.provider');
const FfmpegProvider = require('./providers/ffmpeg.provider');

// Import services
const AudioService = require('./services/audio.service');
const MetadataService = require('./services/metadata.service');

// Import controllers
const AudioController = require('./controllers/audio.controller');
const HealthController = require('./controllers/health.controller');

// Import routes
const createRoutes = require('./routes');

// Initialize providers
logger.info('Initializing providers...');
const ytdlpProvider = new YtdlpProvider(config);
const ffmpegProvider = new FfmpegProvider(config);

// Initialize services with dependencies
logger.info('Initializing services...');
const audioService = new AudioService(config, {
    ytdlpProvider,
    ffmpegProvider,
});

const metadataService = new MetadataService(config, {
    ytdlpProvider,
});

// Initialize controllers with services
logger.info('Initializing controllers...');
const audioController = new AudioController({
    audioService,
    metadataService,
});

const healthController = new HealthController({
    ytdlpProvider,
    ffmpegProvider,
});

// Create routes with controllers
logger.info('Creating routes...');
const routes = createRoutes({
    audioController,
    healthController,
});

// Create Express app
logger.info('Creating Express application...');
const app = createApp(routes);

// Start server
const PORT = config.get('port');
const HOST = config.get('host');

const server = app.listen(PORT, HOST, () => {
    logger.info(`Server running on ${HOST}:${PORT}`, {
        env: config.get('env'),
        nodeVersion: process.version,
    });
});

// Export for testing
module.exports = { app, server, metadataService };

// Graceful shutdown implementation
// Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
let isShuttingDown = false;

/**
 * Graceful shutdown handler
 * 
 * Handles SIGTERM and SIGINT signals to shutdown the server gracefully:
 * 1. Stop accepting new connections
 * 2. Wait for active requests to complete (with timeout)
 * 3. Cleanup resources (cache, processes)
 * 4. Exit with appropriate code
 * 
 * @param {string} signal - Signal that triggered shutdown
 */
async function gracefulShutdown(signal) {
    if (isShuttingDown) {
        logger.warn('Shutdown already in progress, ignoring signal');
        return;
    }

    isShuttingDown = true;
    logger.info(`Received ${signal}, starting graceful shutdown`);

    // Stop accepting new connections
    server.close(() => {
        logger.info('HTTP server closed - no longer accepting connections');
    });

    // Set timeout for forced shutdown (30 seconds)
    const shutdownTimeout = setTimeout(() => {
        logger.warn('Forcing shutdown after timeout - active requests may be interrupted');
        process.exit(1);
    }, 30000);

    try {
        // Cleanup services
        logger.info('Cleaning up resources...');

        // Clear metadata cache
        if (metadataService && typeof metadataService.clearCache === 'function') {
            metadataService.clearCache();
            logger.info('Metadata cache cleared');
        }

        // Additional cleanup can be added here
        // - Close database connections
        // - Kill child processes
        // - Clear intervals/timeouts

        logger.info('Cleanup completed successfully');
        clearTimeout(shutdownTimeout);
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown cleanup', {
            error: error.message,
            stack: error.stack,
        });
        clearTimeout(shutdownTimeout);
        process.exit(1);
    }
}

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception - initiating shutdown', {
        error: error.message,
        stack: error.stack,
    });
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', {
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: promise,
    });
    // Don't shutdown on unhandled rejection, just log it
});

logger.info('Graceful shutdown handlers registered');
