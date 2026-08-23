'use strict';

/**
 * Bootstrap Entry Point
 * 
 * Main entry point for the bot using CodeIgniter-inspired architecture.
 * Initializes Discord client, loads core libraries, manages the embedded HTTP server,
 * and handles the unified bot lifecycle.
 */

const { Client, IntentsBitField } = require('discord.js');
const Loader = require('./system/core/Loader');
const ServiceContainer = require('./system/core/ServiceContainer');
const EventManager = require('./system/managers/EventManager');
const InteractionManager = require('./system/managers/InteractionManager');
const CleanupManager = require('./system/managers/CleanupManager');
const CoreLibrariesInitializer = require('./system/initialization/CoreLibrariesInitializer');
const ModuleLoader = require('./system/initialization/ModuleLoader');
const EventLoader = require('./system/initialization/EventLoader');
const InteractionLoader = require('./system/initialization/InteractionLoader');
const HttpServer = require('./system/server/HttpServer');
const config = require('./application/config/config');
const logger = require('./system/helpers/LoggerHelper');
const { rateLimitTracker } = require('./system/helpers/RateLimitHelper');

class Bot {
    /**
     * Create a new Bot instance
     */
    constructor() {
        // Initialize Discord client with required intents
        this.client = new Client({
            intents: [
                IntentsBitField.Flags.Guilds,
                IntentsBitField.Flags.GuildVoiceStates,
                IntentsBitField.Flags.GuildMessages,
                IntentsBitField.Flags.GuildMembers,
                IntentsBitField.Flags.MessageContent,
            ],
        });

        // Store config reference
        this.config = config;

        // Initialize loader for this bot instance
        this.load = new Loader(this);

        // Initialize service container for dependency injection
        this.serviceContainer = new ServiceContainer(this.client);

        // Controllers registry
        this.controllers = new Map();

        // Modules registry
        this.modules = new Map();

        // Services registry (backed by service container)
        this.services = new Map();

        // Guild states for managing per-guild data
        this.client.guildStates = new Map();

        // Attach logger to client
        this.client.logger = logger;

        // Attach loader to client for global access
        this.client.loader = this.load;

        // Attach service container to client for global access
        this.client.serviceContainer = this.serviceContainer;

        // Attach modules, controllers, and services to client for event access
        this.client.modules = this.modules;
        this.client.controllers = this.controllers;
        this.client.services = this.services;

        // Initialize EventManager
        this.eventManager = new EventManager(this.client);

        // Initialize InteractionManager
        this.interactionManager = new InteractionManager(this.client);

        // Initialize CleanupManager
        this.cleanupManager = new CleanupManager(this.client);

        // Embedded HTTP Server reference
        this.httpServer = null;

        // Attach managers to client for event access
        this.client.interactionManager = this.interactionManager;
        this.client.cleanupManager = this.cleanupManager;

        // Attach rate limit tracker to client
        this.client.rateLimitTracker = rateLimitTracker;

        // Setup rate limit handling
        this.setupRateLimitHandling();
    }

    /**
     * Load core system libraries
     * These are loaded once at startup and shared across all controllers
     */
    async loadCoreLibraries() {
        const coreLibrariesInitializer = new CoreLibrariesInitializer(this);
        await coreLibrariesInitializer.initialize();
    }

    /**
     * Initialize and start the bot
     */
    async init() {
        try {
            logger.info('Initializing unified EyeDaemon...');

            // Validate configuration
            this.validateConfig();

            // Load core libraries first (including database, audio player, stream service)
            await this.loadCoreLibraries();

            // Start embedded HTTP server if enabled
            if (config.server.enabled) {
                this.httpServer = new HttpServer(this.client, {
                    port: config.server.port,
                    audioStreamService: this.client.audioStreamService || this.audioPlayer?.audioStreamService,
                });
                await this.httpServer.start();
                this.client.httpServer = this.httpServer;
            }

            // Load modules and controllers
            await this.loadModules();

            // Load event handlers (must be before login)
            await this.loadEvents();

            // Load interaction handlers
            await this.loadInteractions();

            // Setup error handlers
            this.setupErrorHandlers();

            // Login to Discord
            logger.info('Logging in to Discord...');
            await this.client.login(config.token);

            logger.info('EyeDaemon initialized and running successfully');
        } catch (error) {
            logger.error('Failed to initialize bot', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Validate required configuration
     */
    validateConfig() {
        if (!config.token) {
            throw new Error('DISCORD_TOKEN is required in environment variables');
        }

        if (!config.clientId) {
            throw new Error('DISCORD_CLIENT_ID is required in environment variables');
        }

        logger.info('Configuration validated');
    }

    /**
     * Load all modules and their controllers
     * Dynamically loads modules from application/modules directory
     */
    async loadModules() {
        const moduleLoader = new ModuleLoader(this);
        await moduleLoader.loadModules();
    }

    /**
     * Load Discord event handlers using EventManager
     */
    async loadEvents() {
        const eventLoader = new EventLoader(this);
        await eventLoader.loadEvents();
    }

    /**
     * Load interaction handlers using InteractionManager
     */
    async loadInteractions() {
        const interactionLoader = new InteractionLoader(this);
        await interactionLoader.loadInteractions();
    }

    /**
     * Shutdown the bot gracefully
     */
    async shutdown() {
        try {
            logger.info('Shutting down EyeDaemon...');

            // Stop embedded HTTP server
            if (this.httpServer) {
                await this.httpServer.stop();
                logger.info('HTTP server stopped');
            }

            // Shutdown services via service container
            if (this.serviceContainer) {
                await this.serviceContainer.shutdownAll();
            }

            // Stop health check service
            if (this.healthCheckService) {
                this.healthCheckService.shutdown();
                logger.info('Health check service stopped');
            }

            // Stop CleanupManager
            if (this.cleanupManager) {
                this.cleanupManager.stop();
            }

            // Cleanup event handlers
            if (this.eventManager) {
                this.eventManager.cleanup();
            }

            // Cleanup interaction handlers
            if (this.interactionManager) {
                this.interactionManager.cleanup();
            }

            // Cleanup voice connections
            if (this.voiceManager) {
                const connections = this.voiceManager.connections;
                for (const [guildId] of connections) {
                    this.voiceManager.leave(guildId);
                }
            }

            // Shutdown presence manager
            if (this.presenceManager) {
                this.presenceManager.shutdown();
                logger.info('Presence manager shutdown');
            }

            // Shutdown mutex manager
            if (this.mutexManager) {
                await this.mutexManager.shutdown();
                logger.info('Mutex manager shutdown');
            }

            // Shutdown cache manager
            if (this.cacheManager) {
                await this.cacheManager.shutdown();
                logger.info('Cache manager shutdown');
            }

            // Drain connection pool
            if (this.connectionPool) {
                await this.connectionPool.drain();
                logger.info('Connection pool drained');
            }

            // Close database connection
            if (this.database) {
                await this.database.close();
                logger.info('Database connection closed');
            }

            // Clear registries
            this.services.clear();
            this.controllers.clear();
            this.modules.clear();
            this.client.guildStates.clear();

            // Clear service container
            if (this.serviceContainer) {
                this.serviceContainer.clear();
            }

            // Destroy Discord client
            this.client.destroy();

            logger.info('EyeDaemon shutdown complete');
        } catch (error) {
            logger.error('Error during shutdown', {
                error: error.message,
                stack: error.stack,
            });
        }
    }

    /**
     * Setup rate limit handling for Discord client
     */
    setupRateLimitHandling() {
        this.client.on('rateLimit', (rateLimitInfo) => {
            logger.warn('Discord API rate limit hit', {
                timeout: rateLimitInfo.timeout,
                limit: rateLimitInfo.limit,
                method: rateLimitInfo.method,
                path: rateLimitInfo.path,
                route: rateLimitInfo.route,
                global: rateLimitInfo.global,
            });

            if (rateLimitInfo.route) {
                rateLimitTracker.setRateLimit(rateLimitInfo.route, rateLimitInfo.timeout);
            }
        });

        logger.info('Rate limit handling configured');
    }

    /**
     * Setup global error handlers
     */
    setupErrorHandlers() {
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception', {
                error: error.message,
                stack: error.stack,
            });

            this.shutdown().finally(() => {
                process.exit(1);
            });
        });

        process.on('unhandledRejection', (reason) => {
            logger.error('Unhandled Rejection', {
                reason: reason?.message || reason,
                stack: reason?.stack,
            });
        });

        process.on('SIGINT', () => {
            logger.info('Received SIGINT, shutting down gracefully');
            this.shutdown().finally(() => {
                process.exit(0);
            });
        });

        process.on('SIGTERM', () => {
            logger.info('Received SIGTERM, shutting down gracefully');
            this.shutdown().finally(() => {
                process.exit(0);
            });
        });
    }
}

module.exports = Bot;
