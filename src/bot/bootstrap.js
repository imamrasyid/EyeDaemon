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

            // Load atomic operations library
            const AtomicOperations = require('./system/libraries/AtomicOperations');
            this.atomicOperations = new AtomicOperations(this.database, {
                maxRetries: 3,
                retryDelay: 100,
            });
            this.client.atomicOperations = this.atomicOperations;
            logger.info('Atomic operations initialized');

            // Load mutex manager
            const MutexManager = require('./system/libraries/MutexManager');
            this.mutexManager = new MutexManager(this.database, {
                defaultTimeout: 5000,
                cleanupInterval: 60000,
                ownerId: `bot-${this.client.user?.id || 'unknown'}`,
            });
            this.client.mutexManager = this.mutexManager;
            logger.info('Mutex manager initialized');

            // Load cache invalidator (requires cache manager and mutex manager)
            if (this.cacheManager) {
                const CacheInvalidator = require('./system/libraries/CacheInvalidator');
                this.cacheInvalidator = new CacheInvalidator(this.cacheManager, this.mutexManager, {
                    stampedeTimeout: 5000,
                    defaultTTL: 600000, // 10 minutes
                });
                this.client.cacheInvalidator = this.cacheInvalidator;
                logger.info('Cache invalidator initialized');
            } else {
                logger.warn('Cache invalidator not initialized (cache manager required)');
                this.cacheInvalidator = null;
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

            // Load presence manager
            const PresenceManager = require('./system/libraries/presence_manager');
            this.presenceManager = new PresenceManager(this.client, {
                rotationInterval: 60000,
                defaultStatus: 'online',
            });
            this.client.presenceManager = this.presenceManager;
            logger.info('Presence manager initialized');

            // Initialize command manager
            const CommandManager = require('./system/managers/command_manager');
            this.commandManager = new CommandManager(this.client);
            this.client.commandManager = this.commandManager;
            logger.info('Command manager initialized');

            // Initialize interaction components manager
            const InteractionComponentsManager = require('./system/managers/interaction_components_manager');
            this.interactionComponentsManager = new InteractionComponentsManager(this.client);
            this.client.interactionComponentsManager = this.interactionComponentsManager;
            logger.info('Interaction components manager initialized');

            // Initialize message command manager
            const MessageCommandManager = require('./system/managers/message_command_manager');
            this.messageCommandManager = new MessageCommandManager(this.client);
            this.client.messageCommandManager = this.messageCommandManager;
            logger.info('Message command manager initialized');

            // Initialize bot identity service
            const BotIdentityService = require('./system/services/bot_identity_service');
            this.botIdentityService = new BotIdentityService(this.client);
            this.client.botIdentityService = this.botIdentityService;
            logger.info('Bot identity service initialized');

            // Initialize embed builder
            const EmbedBuilderLibrary = require('./system/libraries/embed_builder');
            this.embedBuilder = new EmbedBuilderLibrary(this.client);
            this.client.embedBuilder = this.embedBuilder;
            logger.info('Embed builder initialized');

            // Initialize pagination manager
            const PaginationManager = require('./system/managers/pagination_manager');
            this.paginationManager = new PaginationManager(this.client);
            this.client.paginationManager = this.paginationManager;
            logger.info('Pagination manager initialized');

            // Initialize message service
            const MessageService = require('./system/services/message_service');
            this.messageService = new MessageService(this.client);
            this.client.messageService = this.messageService;
            logger.info('Message service initialized');

            // Initialize attachment service
            const AttachmentService = require('./system/services/attachment_service');
            this.attachmentService = new AttachmentService(this.client);
            this.client.attachmentService = this.attachmentService;
            logger.info('Attachment service initialized');

            // Initialize member management service
            const MemberManagementService = require('./system/services/member_management_service');
            this.memberManagementService = new MemberManagementService(this.client);
            this.client.memberManagementService = this.memberManagementService;
            logger.info('Member management service initialized');

            // Initialize role management service
            const RoleManagementService = require('./system/services/role_management_service');
            this.roleManagementService = new RoleManagementService(this.client);
            this.client.roleManagementService = this.roleManagementService;
            logger.info('Role management service initialized');

            // Initialize automated moderation service
            const AutomatedModerationService = require('./system/services/automated_moderation_service');
            this.automatedModerationService = new AutomatedModerationService(this.client);
            this.client.automatedModerationService = this.automatedModerationService;
            logger.info('Automated moderation service initialized');

            // Initialize moderation logging service
            const ModerationLoggingService = require('./system/services/moderation_logging_service');
            this.moderationLoggingService = new ModerationLoggingService(this.client);
            this.client.moderationLoggingService = this.moderationLoggingService;
            logger.info('Moderation logging service initialized');

            // Initialize automation service (if not already initialized in ready event)
            if (!this.automationService) {
                const AutomationService = require('./system/services/automation_service');
                this.automationService = new AutomationService(this.client);
                this.client.automationService = this.automationService;
                logger.info('Automation service initialized');
            }

            // Initialize webhook service
            const WebhookService = require('./system/services/webhook_service');
            this.webhookService = new WebhookService(this.client);
            this.client.webhookService = this.webhookService;
            logger.info('Webhook service initialized');

            // Initialize integration service
            const IntegrationService = require('./system/services/integration_service');
            this.integrationService = new IntegrationService(this.client);
            this.client.integrationService = this.integrationService;
            logger.info('Integration service initialized');

            // Initialize economy enhancement service
            const EconomyEnhancementService = require('./system/services/economy_enhancement_service');
            this.economyEnhancementService = new EconomyEnhancementService(this.client);
            this.client.economyEnhancementService = this.economyEnhancementService;
            logger.info('Economy enhancement service initialized');

            // Initialize analytics service
            const AnalyticsService = require('./system/services/analytics_service');
            this.analyticsService = new AnalyticsService(this.client);
            this.client.analyticsService = this.analyticsService;
            logger.info('Analytics service initialized');

            // Initialize security service
            const SecurityService = require('./system/services/security_service');
            this.securityService = new SecurityService(this.client);
            this.client.securityService = this.securityService;
            logger.info('Security service initialized');

            // Initialize developer tools service
            const DeveloperToolsService = require('./system/services/developer_tools_service');
            this.developerToolsService = new DeveloperToolsService(this.client);
            this.client.developerToolsService = this.developerToolsService;
            logger.info('Developer tools service initialized');

            // Initialize experimental service
            const ExperimentalService = require('./system/services/experimental_service');
            this.experimentalService = new ExperimentalService(this.client);
            this.client.experimentalService = this.experimentalService;
            logger.info('Experimental service initialized');

            // Initialize UI/experience service
            const UIExperienceService = require('./system/services/ui_experience_service');
            this.uiExperienceService = new UIExperienceService(this.client);
            this.client.uiExperienceService = this.uiExperienceService;
            logger.info('UI experience service initialized');

            // Initialize database enhancement service
            const DatabaseEnhancementService = require('./system/services/database_enhancement_service');
            this.databaseEnhancementService = new DatabaseEnhancementService(this.client);
            this.client.databaseEnhancementService = this.databaseEnhancementService;
            logger.info('Database enhancement service initialized');

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
