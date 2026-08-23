/**
 * CoreLibrariesInitializer
 * 
 * Handles initialization of core system libraries including database,
 * connection pool, cache manager, and other foundational components.
 */

const logger = require('../helpers/LoggerHelper');

class CoreLibrariesInitializer {
    /**
     * Create a new CoreLibrariesInitializer instance
     * @param {Object} bot - Bot instance
     */
    constructor(bot) {
        this.bot = bot;
    }

    /**
     * Initialize all core libraries
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            logger.info('Loading core libraries...');

            // Load database connection first
            await this.initializeDatabase();

            // Load connection pool (optional)
            await this.initializeConnectionPool();

            // Load cache manager (optional)
            await this.initializeCacheManager();

            // Load atomic operations
            await this.initializeAtomicOperations();

            // Load mutex manager
            await this.initializeMutexManager();

            // Load cache invalidator
            await this.initializeCacheInvalidator();

            // Load migration manager
            await this.initializeMigrationManager();

            // Load health check service
            await this.initializeHealthCheckService();

            // Load voice-related libraries
            await this.initializeVoiceLibraries();

            // Load presence manager
            await this.initializePresenceManager();

            // Load command managers
            await this.initializeCommandManagers();

            // Load system services
            await this.initializeSystemServices();

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
     * Initialize database connection
     * @private
     */
    async initializeDatabase() {
        this.bot.database = this.bot.load.library('Database');
        await this.bot.database.connect();
        this.bot.client.database = this.bot.database;
        logger.info('Database initialized');
    }

    /**
     * Initialize connection pool (optional)
     * @private
     */
    async initializeConnectionPool() {
        try {
            this.bot.connectionPool = this.bot.load.library('ConnectionPool');
            await this.bot.connectionPool.initialize();
            this.bot.client.connectionPool = this.bot.connectionPool;
            logger.info('Connection pool initialized');
        } catch (error) {
            logger.warn('Connection pool not initialized (optional)', {
                error: error.message,
            });
            this.bot.connectionPool = null;
        }
    }

    /**
     * Initialize cache manager (optional)
     * @private
     */
    async initializeCacheManager() {
        try {
            this.bot.cacheManager = this.bot.load.library('CacheManager');
            await this.bot.cacheManager.initialize();
            this.bot.client.cacheManager = this.bot.cacheManager;
            logger.info('Cache manager initialized');
        } catch (error) {
            logger.warn('Cache manager not initialized (optional)', {
                error: error.message,
            });
            this.bot.cacheManager = null;
        }
    }

    /**
     * Initialize atomic operations
     * @private
     */
    async initializeAtomicOperations() {
        const AtomicOperations = require('../libraries/AtomicOperations');
        this.bot.atomicOperations = new AtomicOperations(this.bot.database, {
            maxRetries: 3,
            retryDelay: 100,
        });
        this.bot.client.atomicOperations = this.bot.atomicOperations;
        logger.info('Atomic operations initialized');
    }

    /**
     * Initialize mutex manager
     * @private
     */
    async initializeMutexManager() {
        const MutexManager = require('../libraries/MutexManager');
        this.bot.mutexManager = new MutexManager(null, {
            defaultTimeout: 5000,
        });
        this.bot.client.mutexManager = this.bot.mutexManager;
        logger.info('Mutex manager initialized');
    }

    /**
     * Initialize cache invalidator
     * @private
     */
    async initializeCacheInvalidator() {
        if (this.bot.cacheManager) {
            const CacheInvalidator = require('../libraries/CacheInvalidator');
            this.bot.cacheInvalidator = new CacheInvalidator(this.bot.cacheManager, this.bot.mutexManager, {
                stampedeTimeout: 5000,
                defaultTTL: 600000, // 10 minutes
            });
            this.bot.client.cacheInvalidator = this.bot.cacheInvalidator;
            logger.info('Cache invalidator initialized');
        } else {
            logger.warn('Cache invalidator not initialized (cache manager required)');
            this.bot.cacheInvalidator = null;
        }
    }

    /**
     * Initialize migration manager
     * @private
     */
    async initializeMigrationManager() {
        const MigrationManager = require('../database/MigrationManager');
        this.bot.migrationManager = new MigrationManager(this.bot.database);
        this.bot.client.migrationManager = this.bot.migrationManager;
        logger.info('Migration manager initialized');
    }

    /**
     * Initialize health check service
     * @private
     */
    async initializeHealthCheckService() {
        const HealthCheckService = require('../services/HealthCheckService');
        this.bot.healthCheckService = new HealthCheckService({
            database: this.bot.database,
            connectionPool: this.bot.connectionPool,
            cacheManager: this.bot.cacheManager,
            migrationManager: this.bot.migrationManager,
            logger: logger,
            checkInterval: 300000, // 5 minutes
            enablePeriodicChecks: true,
            onFailure: async (healthResult) => {
                logger.error('Health check failed', {
                    status: healthResult.status,
                    issues: healthResult.issues,
                    consecutiveFailures: healthResult.consecutiveFailures,
                });
            },
        });
        this.bot.client.healthCheckService = this.bot.healthCheckService;
        logger.info('Health check service initialized');
    }

    /**
     * Initialize voice-related libraries
     * @private
     */
    async initializeVoiceLibraries() {
        this.bot.voiceManager = this.bot.load.library('VoiceManager');
        this.bot.audioPlayer = this.bot.load.library('AudioPlayer');
        this.bot.queueManager = this.bot.load.library('QueueManager');
        this.bot.client.voiceManager = this.bot.voiceManager;
        this.bot.client.audioPlayer = this.bot.audioPlayer;
        this.bot.client.queueManager = this.bot.queueManager;
        if (this.bot.audioPlayer?.audioStreamService) {
            this.bot.client.audioStreamService = this.bot.audioPlayer.audioStreamService;
        }
        logger.info('Voice libraries initialized');
    }

    /**
     * Initialize presence manager
     * @private
     */
    async initializePresenceManager() {
        const PresenceManager = require('../libraries/PresenceManager');
        this.bot.presenceManager = new PresenceManager(this.bot.client, {
            rotationInterval: 60000,
            defaultStatus: 'online',
        });
        this.bot.client.presenceManager = this.bot.presenceManager;
        logger.info('Presence manager initialized');
    }

    /**
     * Initialize command managers
     * @private
     */
    async initializeCommandManagers() {
        const CommandManager = require('../managers/CommandManager');
        this.bot.commandManager = new CommandManager(this.bot.client);
        this.bot.client.commandManager = this.bot.commandManager;
        logger.info('Command manager initialized');

        const InteractionComponentsManager = require('../managers/InteractionComponentsManager');
        this.bot.interactionComponentsManager = new InteractionComponentsManager(this.bot.client);
        this.bot.client.interactionComponentsManager = this.bot.interactionComponentsManager;
        logger.info('Interaction components manager initialized');

        const MessageCommandManager = require('../managers/MessageCommandManager');
        this.bot.messageCommandManager = new MessageCommandManager(this.bot.client);
        this.bot.client.messageCommandManager = this.bot.messageCommandManager;
        logger.info('Message command manager initialized');

        const PaginationManager = require('../managers/PaginationManager');
        this.bot.paginationManager = new PaginationManager(this.bot.client);
        this.bot.client.paginationManager = this.bot.paginationManager;
        logger.info('Pagination manager initialized');
    }

    /**
     * Initialize system services
     * @private
     */
    async initializeSystemServices() {
        const services = [
            { name: 'BotIdentityService', path: '../services/BotIdentityService' },
            { name: 'MessageService', path: '../services/MessageService' },
            { name: 'AttachmentService', path: '../services/AttachmentService' },
            { name: 'MemberManagementService', path: '../services/MemberManagementService' },
            { name: 'RoleManagementService', path: '../services/RoleManagementService' },
            { name: 'AutomatedModerationService', path: '../services/AutomatedModerationService' },
            { name: 'ModerationLoggingService', path: '../services/ModerationLoggingService' },
            { name: 'AutomationService', path: '../services/AutomationService' },
            { name: 'WebhookService', path: '../services/WebhookService' },
            { name: 'IntegrationService', path: '../services/IntegrationService' },
            { name: 'EconomyEnhancementService', path: '../services/EconomyEnhancementService' },
            { name: 'AnalyticsService', path: '../services/AnalyticsService' },
            { name: 'SecurityService', path: '../services/SecurityService' },
            { name: 'DeveloperToolsService', path: '../services/DeveloperToolsService' },
            { name: 'ExperimentalService', path: '../services/ExperimentalService' },
            { name: 'UIExperienceService', path: '../services/UIExperienceService' },
            { name: 'DatabaseEnhancementService', path: '../services/DatabaseEnhancementService' },
        ];

        for (const service of services) {
            const ServiceClass = require(service.path);
            const serviceInstance = new ServiceClass(this.bot.client);
            const serviceName = service.name.charAt(0).toLowerCase() + service.name.slice(1);
            this.bot[serviceName] = serviceInstance;
            this.bot.client[serviceName] = serviceInstance;
            logger.info(`${service.name} initialized`);
        }

        // Initialize embed builder separately
        const EmbedBuilderLibrary = require('../libraries/EmbedBuilder');
        this.bot.embedBuilder = new EmbedBuilderLibrary(this.bot.client);
        this.bot.client.embedBuilder = this.bot.embedBuilder;
        logger.info('Embed builder initialized');
    }
}

module.exports = CoreLibrariesInitializer;
