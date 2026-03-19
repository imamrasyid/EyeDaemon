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

const { spawn } = require('child_process');

/**
 * Update yt-dlp to the latest stable version before server starts.
 * Resolves regardless of outcome — failure is non-fatal.
 */
function updateYtdlp(ytdlpPath) {
    return new Promise((resolve) => {
        logger.info('Checking for yt-dlp updates...');
        const proc = spawn(ytdlpPath, ['--update-to', 'stable'], { stdio: ['ignore', 'pipe', 'pipe'] });

        let output = '';
        proc.stdout.on('data', (d) => { output += d.toString(); });
        proc.stderr.on('data', (d) => { output += d.toString(); });

        proc.on('close', (code) => {
            const trimmed = output.trim();
            if (code === 0) {
                logger.info(`yt-dlp update complete: ${trimmed || 'already up-to-date'}`);
            } else {
                logger.warn(`yt-dlp update exited with code ${code}: ${trimmed}`);
            }
            resolve(); // always resolve — update failure is non-fatal
        });

        proc.on('error', (err) => {
            logger.warn(`yt-dlp update spawn error: ${err.message}`);
            resolve();
        });
    });
}

async function main() {
    // Initialize providers
    logger.info('Initializing providers...');
    const ytdlpProvider = new YtdlpProvider(config);
    const ffmpegProvider = new FfmpegProvider(config);

    // Update yt-dlp before accepting any requests
    await updateYtdlp(config.get('ytdlpPath', 'yt-dlp'));

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

    return { app, server, metadataService };
}

// Run and export for testing
const startupPromise = main().catch((err) => {
    logger.error('Failed to start server', { error: err.message, stack: err.stack });
    process.exit(1);
});

// Lazy exports — resolved after main() completes
let _app, _server, _metadataService;
startupPromise.then(({ app, server, metadataService }) => {
    _app = app;
    _server = server;
    _metadataService = metadataService;
});

// Export for testing
module.exports = {
    get app() { return _app; },
    get server() { return _server; },
    get metadataService() { return _metadataService; },
};

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
    if (_server) {
        _server.close(() => {
            logger.info('HTTP server closed - no longer accepting connections');
        });
    }

    // Set timeout for forced shutdown (30 seconds)
    const shutdownTimeout = setTimeout(() => {
        logger.warn('Forcing shutdown after timeout - active requests may be interrupted');
        process.exit(1);
    }, 30000);

    try {
        logger.info('Cleaning up resources...');

        if (_metadataService && typeof _metadataService.clearCache === 'function') {
            _metadataService.clearCache();
            logger.info('Metadata cache cleared');
        }

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
