/**
 * Bootstrap Entry Point
 * 
 * Main entry point for the bot using CodeIgniter-inspired architecture.
 * Initializes Discord client, loads core libraries, and manages the bot lifecycle.
 */

const { Client, GatewayIntentBits } = require('discord.js');
const Loader = require('./system/core/Loader');
const EventManager = require('./system/managers/EventManager');
const InteractionManager = require('./system/managers/InteractionManager');
const CleanupManager = require('./system/managers/CleanupManager');
const config = require('./application/config/config');
const logger = require('./system/helpers/logger_helper');
const { rateLimitTracker } = require('./system/helpers/rate_limit_helper');

class Bot {
    /**
     * Create a new Bot instance
     */
    constructor() {
        // Initialize Discord client with required intents
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.MessageContent,
            ],
        });

        // Store config reference
        this.config = config;

        // Initialize loader for this bot instance
        this.load = new Loader(this);

        // Controllers registry
        this.controllers = new Map();

        // Modules registry
        this.modules = new Map();

        // Services registry
        this.services = new Map();

        // Guild states for managing per-guild data
        this.client.guildStates = new Map();

        // Attach logger to client
        this.client.logger = logger;

        // Attach loader to client for global access
        this.client.loader = this.load;

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
        try {
            logger.info('Loading core libraries...');

            // Load database connection first
            this.database = this.load.library('Database');
            await this.database.connect();

            // Attach database to client for global access
            this.client.database = this.database;

            // Load connection pool (optional, if configured)
            try {
                this.connectionPool = this.load.library('ConnectionPool');
                await this.connectionPool.initialize();
                this.client.connectionPool = this.connectionPool;
                logger.info('Connection pool initialized');
            } catch (error) {
                logger.warn('Connection pool not initialized (optional)', {
                    error: error.message,
                });
                this.connectionPool = null;
            }

            // Load cache manager (optional, if configured)
            try {
                this.cacheManager = this.load.library('CacheManager');
                await this.cacheManager.initialize();
                this.client.cacheManager = this.cacheManager;
                logger.info('Cache manager initialized');
            } catch (error) {
                logger.warn('Cache manager not initialized (optional)', {
                    error: error.message,
                });
                this.cacheManager = null;
            }

            // Load migration manager
            const MigrationManager = require('./system/database/MigrationManager');
            this.migrationManager = new MigrationManager(this.database);
            this.client.migrationManager = this.migrationManager;

            // Initialize health check service
            const HealthCheckService = require('./system/services/HealthCheckService');
            this.healthCheckService = new HealthCheckService({
                database: this.database,
                connectionPool: this.connectionPool,
                cacheManager: this.cacheManager,
                migrationManager: this.migrationManager,
                logger: logger,
                checkInterval: 300000, // 5 minutes
                enablePeriodicChecks: true,
                onFailure: async (healthResult) => {
                    // Alert on health check failures
                    logger.error('Health check failed', {
                        status: healthResult.status,
                        issues: healthResult.issues,
                        consecutiveFailures: healthResult.consecutiveFailures,
                    });

                    // Additional alerting logic can be added here
                    // For example: send notification to admin channel, trigger webhook, etc.
                },
            });

            // Attach health check service to client for global access
            this.client.healthCheckService = this.healthCheckService;

            logger.info('Health check service initialized');

            // Load voice manager for voice connection management
            this.voiceManager = this.load.library('VoiceManager');

            // Load audio player for music playback
            this.audioPlayer = this.load.library('AudioPlayer');

            // Load queue manager for queue management
            this.queueManager = this.load.library('QueueManager');

            logger.info('Core libraries loaded successfully');
        } catch (error) {
            logger.error('Failed to load core libraries', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Initialize and start the bot
     */
    async init() {
        try {
            logger.info('Initializing bot...');

            // Validate configuration
            this.validateConfig();

            // Load core libraries first (including database)
            await this.loadCoreLibraries();

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

            logger.info('Bot initialized successfully');
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
        try {
            logger.info('Loading modules...');

            // Load global services first (before modules)
            await this.loadGlobalServices();

            // List of modules to load (based on feature flags)
            const modulesToLoad = [];

            // Add all available modules based on feature flags
            if (config.features.music) {
                modulesToLoad.push('music');
            }

            if (config.features.economy) {
                modulesToLoad.push('economy');
            }

            if (config.features.leveling) {
                modulesToLoad.push('leveling');
            }

            if (config.features.moderation) {
                modulesToLoad.push('moderation');
            }

            if (config.features.tickets) {
                modulesToLoad.push('ticket');
            }

            // Admin module (always loaded if available)
            modulesToLoad.push('admin');

            // Utility module (always loaded if available)
            modulesToLoad.push('utility');

            // Load each module
            for (const moduleName of modulesToLoad) {
                try {
                    // Load module definition
                    const module = require(`./application/modules/${moduleName}`);

                    // Add getService method to module
                    module.getService = (serviceName) => {
                        return this.services.get(serviceName);
                    };

                    this.modules.set(moduleName, module);

                    logger.info(`Loading module: ${module.name}`);

                    // Load services for this module
                    if (module.services && module.services.length > 0) {
                        for (const serviceName of module.services) {
                            if (!this.services.has(serviceName)) {
                                const ServiceClass = require(`./application/modules/${moduleName}/services/${serviceName}`);
                                const serviceInstance = new ServiceClass(this.client);
                                await serviceInstance.initialize();
                                this.services.set(serviceName, serviceInstance);

                                logger.info(`  - Loaded service: ${serviceName}`);
                            }
                        }
                    }

                    // Load controllers for this module
                    for (const controllerName of module.controllers) {
                        if (!this.controllers.has(controllerName)) {
                            const ControllerClass = require(`./application/controllers/${controllerName}`);
                            const controllerInstance = new ControllerClass(this.client);
                            this.controllers.set(controllerName, controllerInstance);

                            logger.info(`  - Loaded controller: ${controllerName}`);
                        }
                    }

                    logger.info(`Module loaded: ${module.name} (${module.commands.length} commands)`);
                } catch (error) {
                    logger.error(`Failed to load module: ${moduleName}`, {
                        error: error.message,
                        stack: error.stack,
                    });
                    // Continue loading other modules even if one fails
                }
            }

            logger.info(`Loaded ${this.modules.size} modules with ${this.services.size} services and ${this.controllers.size} controllers`);

            // Validate command methods after all modules are loaded
            this.validateCommandMethods();
        } catch (error) {
            logger.error('Failed to load modules', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Validate command methods to detect naming conflicts
     * Checks if all command methods are actually functions and not shadowed by properties
     */
    validateCommandMethods() {
        try {
            logger.info('Validating command methods...');

            let totalCommands = 0;
            let conflictCount = 0;
            const conflicts = [];

            // Iterate through all modules
            for (const [moduleName, module] of this.modules) {
                // Check each command in the module
                for (const command of module.commands) {
                    totalCommands++;

                    const controller = this.controllers.get(command.controller);

                    if (!controller) {
                        logger.warn(`Command ${command.name} references missing controller: ${command.controller}`);
                        conflicts.push({
                            command: command.name,
                            controller: command.controller,
                            method: command.method,
                            issue: 'Controller not found',
                        });
                        conflictCount++;
                        continue;
                    }

                    const methodType = typeof controller[command.method];

                    if (methodType !== 'function') {
                        // Get available methods for debugging
                        const availableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(controller))
                            .filter(m => typeof controller[m] === 'function' && m !== 'constructor');

                        logger.warn(`Naming conflict detected for command: ${command.name}`, {
                            controller: command.controller,
                            method: command.method,
                            actualType: methodType,
                            availableMethods: availableMethods.join(', '),
                        });

                        conflicts.push({
                            command: command.name,
                            controller: command.controller,
                            method: command.method,
                            issue: `Method is ${methodType}, not function`,
                            availableMethods,
                        });
                        conflictCount++;
                    }
                }
            }

            // Log validation summary
            if (conflictCount === 0) {
                logger.info(`Command validation complete: ${totalCommands} commands validated, no conflicts found`);
            } else {
                logger.warn(`Command validation complete: ${totalCommands} commands validated, ${conflictCount} conflicts found`, {
                    conflicts,
                });
            }

            return {
                totalCommands,
                conflictCount,
                conflicts,
            };
        } catch (error) {
            logger.error('Failed to validate command methods', {
                error: error.message,
                stack: error.stack,
            });
            return {
                totalCommands: 0,
                conflictCount: 0,
                conflicts: [],
            };
        }
    }

    /**
     * Load global services that are not tied to specific modules
     */
    async loadGlobalServices() {
        try {
            logger.info('Loading global services...');

            // Load GuildInitializationService
            const GuildInitializationService = require('./application/services/GuildInitializationService');
            const guildInitService = new GuildInitializationService(this.client);
            await guildInitService.initialize();

            // Register service globally on client for easy access
            this.client.guildInitializationService = guildInitService;
            this.services.set('GuildInitializationService', guildInitService);

            logger.info('Global services loaded successfully');
        } catch (error) {
            logger.error('Failed to load global services', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Load Discord event handlers using EventManager
     */
    async loadEvents() {
        try {
            const path = require('path');
            const eventsPath = path.join(__dirname, 'application', 'events');

            await this.eventManager.loadEvents(eventsPath);

            logger.info('Event handlers loaded successfully');
        } catch (error) {
            logger.error('Failed to load event handlers', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Load interaction handlers using InteractionManager
     */
    async loadInteractions() {
        try {
            await this.interactionManager.loadInteractions();

            logger.info('Interaction handlers loaded successfully');
        } catch (error) {
            logger.error('Failed to load interaction handlers', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Shutdown the bot gracefully
     */
    async shutdown() {
        try {
            logger.info('Shutting down bot...');

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

            // Shutdown services
            if (this.services) {
                for (const [serviceName, service] of this.services) {
                    try {
                        await service.shutdown();
                        logger.info(`Shutdown service: ${serviceName}`);
                    } catch (error) {
                        logger.error(`Error shutting down service ${serviceName}`, {
                            error: error.message,
                        });
                    }
                }
                this.services.clear();
            }

            // Cleanup voice connections
            if (this.voiceManager) {
                const connections = this.voiceManager.connections;
                for (const [guildId] of connections) {
                    this.voiceManager.leave(guildId);
                }
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

            // Clear guild states
            this.client.guildStates.clear();

            // Destroy Discord client
            this.client.destroy();

            logger.info('Bot shutdown complete');
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
        // Handle rate limit events from Discord.js
        this.client.rest.on('rateLimited', (rateLimitInfo) => {
            logger.warn('Discord API rate limit hit', {
                timeout: rateLimitInfo.timeout,
                limit: rateLimitInfo.limit,
                method: rateLimitInfo.method,
                path: rateLimitInfo.path,
                route: rateLimitInfo.route,
                global: rateLimitInfo.global,
            });

            // Track rate limit
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
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception', {
                error: error.message,
                stack: error.stack,
            });

            // Attempt graceful shutdown
            this.shutdown().finally(() => {
                process.exit(1);
            });
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason) => {
            logger.error('Unhandled Rejection', {
                reason: reason?.message || reason,
                stack: reason?.stack,
            });
        });

        // Handle graceful shutdown signals
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
