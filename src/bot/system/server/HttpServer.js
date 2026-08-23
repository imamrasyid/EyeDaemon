'use strict';

const express = require('express');
const cors = require('cors');
const logger = require('../helpers/LoggerHelper');

/**
 * HttpServer
 * Embedded Express HTTP server for health checks, metrics, and audio API.
 * Runs in the same process as the Discord bot.
 */
class HttpServer {
    constructor(client, options = {}) {
        this.client = client;
        this.app = express();
        this.server = null;
        this.port = options.port || process.env.PORT || process.env.AUDIO_SOURCE_PORT || 3000;
        this.enabled = options.enabled !== undefined ? options.enabled : true;

        this._setupMiddleware();
        this._setupRoutes();
    }

    _setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use((req, res, next) => {
            res.setHeader('X-Powered-By', 'EyeDaemon-Unified');
            next();
        });
    }

    _setupRoutes() {
        // Health check endpoint
        this.app.get(['/', '/health', '/api/health'], (req, res) => {
            const isBotReady = !!(this.client && this.client.isReady && this.client.isReady());
            const dbReady = !!(this.client && this.client.db && this.client.db.isReady && this.client.db.isReady());

            res.json({
                status: 'healthy',
                service: 'EyeDaemon Unified',
                uptime: process.uptime(),
                bot: {
                    ready: isBotReady,
                    user: this.client?.user?.tag || null,
                    guilds: this.client?.guilds?.cache?.size || 0,
                },
                database: {
                    ready: dbReady,
                },
                timestamp: new Date().toISOString(),
            });
        });

        // Audio Stream endpoint (for external players or HTTP inspection)
        this.app.get('/api/audio/stream', async (req, res) => {
            const { query, filter = 'none', start = 0, format = 'webm' } = req.query;

            if (!query) {
                return res.status(400).json({ error: 'Query parameter is required' });
            }

            try {
                const audioStreamService = this.client.audioStreamService ||
                    (this.client.services && this.client.services.get('AudioStreamService'));

                if (!audioStreamService) {
                    return res.status(503).json({ error: 'Audio stream service is unavailable' });
                }

                res.setHeader('Content-Type', `audio/${format}`);
                res.setHeader('Transfer-Encoding', 'chunked');
                res.setHeader('Cache-Control', 'no-store');

                const stream = await audioStreamService.getAudioStream({
                    query,
                    start: Number(start) || 0,
                    filter,
                    format,
                });

                stream.pipe(res);

                req.on('close', () => {
                    if (stream && !stream.destroyed) {
                        stream.destroy();
                    }
                });
            } catch (error) {
                logger.error('HTTP audio stream error', { error: error.message, query });
                if (!res.headersSent) {
                    res.status(500).json({ error: error.message });
                }
            }
        });

        // Metadata endpoint
        this.app.get('/api/audio/metadata', async (req, res) => {
            const { query } = req.query;

            if (!query) {
                return res.status(400).json({ error: 'Query parameter is required' });
            }

            try {
                const metadataService = this.client.metadataService ||
                    (this.client.services && this.client.services.get('MetadataService'));

                if (!metadataService) {
                    return res.status(503).json({ error: 'Metadata service is unavailable' });
                }

                const metadata = await metadataService.getMetadata(query);
                res.json(metadata);
            } catch (error) {
                logger.error('HTTP metadata error', { error: error.message, query });
                res.status(500).json({ error: error.message });
            }
        });
    }

    /**
     * Start the HTTP server
     * @returns {Promise<void>}
     */
    async start() {
        if (!this.enabled) {
            logger.info('HTTP server is disabled by configuration');
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.port, () => {
                    logger.info(`Unified HTTP & Health server listening on port ${this.port}`);
                    resolve();
                });

                this.server.on('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        logger.warn(`Port ${this.port} is in use, running in background without HTTP server`);
                        resolve();
                    } else {
                        logger.error(`HTTP server failed to start: ${err.message}`);
                        reject(err);
                    }
                });
            } catch (err) {
                logger.error(`Error starting HTTP server: ${err.message}`);
                resolve();
            }
        });
    }

    /**
     * Stop the HTTP server
     * @returns {Promise<void>}
     */
    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    logger.info('HTTP server stopped');
                    this.server = null;
                    resolve();
                });
            });
        }
    }
}

module.exports = HttpServer;
