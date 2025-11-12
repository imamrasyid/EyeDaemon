const path = require("path");
const fs = require("fs");
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const CONFIG = require('./config');
const { system: logger } = require('./services/logging.service');
const { getDatabaseService } = require('./services/database.service');
const EventManager = require('./managers/EventManager');
const CommandHandler = require('./managers/CommandHandler');
const InteractionHandler = require('./managers/InteractionHandler');
const PermissionManager = require('./managers/PermissionManager');
const RateLimiter = require('./managers/RateLimiter');

/**
 * EyeDaemon Bot Client - Main bot class
 */
class EyeDaemonClient extends Client {
  constructor(options = {}) {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember
      ],
      ...options
    });

    // Core services
    this.database = null;
    this.modules = new Collection();
    this.services = new Collection();

    // Managers
    this.eventManager = null;
    this.commandHandler = null;
    this.interactionHandler = null;
    this.permissionManager = null;
    this.rateLimiter = null;

    // Bot state
    this.startupTime = null;
    this.isReady = false;
    this.isShuttingDown = false;

    // Error handling
    this.setupErrorHandling();
  }

  /**
   * Initialize the bot client
   */
  async initialize() {
    try {
      logger.info('Initializing EyeDaemon Bot Client');
      this.startupTime = Date.now();

      // Initialize database service
      await this.initializeDatabase();

      // Initialize managers
      await this.initializeManagers();

      // Load modules
      await this.loadModules();

      // Initialize services
      await this.initializeServices();

      // Login to Discord
      await this.login(CONFIG.DISCORD.TOKEN);

      this.isReady = true;
      logger.info(`EyeDaemon Bot Client initialized successfully in ${Date.now() - this.startupTime}ms`);

    } catch (error) {
      logger.error('Failed to initialize bot client', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Initialize database service
   */
  async initializeDatabase() {
    try {
      logger.info('Initializing database service');
      this.database = getDatabaseService();
      await this.database.initialize();
      logger.info('Database service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database service', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize all managers
   */
  async initializeManagers() {
    try {
      logger.info('Initializing managers');

      // Initialize event manager
      this.eventManager = new EventManager(this);
      await this.eventManager.initialize();

      // Initialize command handler
      this.commandHandler = new CommandHandler(this);
      await this.commandHandler.initialize();

      // Initialize interaction handler
      this.interactionHandler = new InteractionHandler(this);
      await this.interactionHandler.initialize();

      // Initialize permission manager
      this.permissionManager = new PermissionManager(this);
      await this.permissionManager.initialize();

      // Initialize rate limiter
      this.rateLimiter = new RateLimiter(this);
      await this.rateLimiter.initialize();

      logger.info('All managers initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize managers', { error: error.message });
      throw error;
    }
  }

  /**
   * Load all modules
   */
  async loadModules() {
    try {
      logger.info('Loading modules');
      
      const modulesDir = path.join(__dirname, 'modules');
      if (!fs.existsSync(modulesDir)) {
        logger.warn('Modules directory not found, creating it');
        fs.mkdirSync(modulesDir, { recursive: true });
        return;
      }

      const moduleFiles = fs.readdirSync(modulesDir).filter(file => 
        file.endsWith('.js') && !file.startsWith('_')
      );

      for (const file of moduleFiles) {
        try {
          const modulePath = path.join(modulesDir, file);
          const ModuleClass = require(modulePath);
          
          if (typeof ModuleClass !== 'function') {
            logger.warn(`Invalid module class in ${file}`);
            continue;
          }

          const module = new ModuleClass(this);
          
          if (!module.name || !module.initialize) {
            logger.warn(`Invalid module structure in ${file}`);
            continue;
          }

          // Check if module is enabled
          if (!module.enabled) {
            logger.debug(`Skipping disabled module: ${module.name}`);
            continue;
          }

          // Initialize module
          await module.initialize();
          
          this.modules.set(module.name, module);
          logger.debug(`Loaded module: ${module.name}`);
          
        } catch (error) {
          logger.error(`Failed to load module ${file}`, { error: error.message });
        }
      }

      logger.info(`Loaded ${this.modules.size} modules successfully`);
    } catch (error) {
      logger.error('Failed to load modules', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize additional services
   */
  async initializeServices() {
    try {
      logger.info('Initializing additional services');

      // Add any additional service initialization here
      
      logger.info('Additional services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize additional services', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', { 
        reason: reason.message || reason,
        stack: reason.stack 
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { 
        error: error.message,
        stack: error.stack 
      });
      
      // Attempt graceful shutdown
      this.shutdown().finally(() => {
        process.exit(1);
      });
    });

    // Handle process termination
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

    // Handle Discord.js errors
    this.on('error', (error) => {
      logger.error('Discord client error', { 
        error: error.message,
        stack: error.stack 
      });
    });

    this.on('warn', (warning) => {
      logger.warn('Discord client warning', { warning });
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.info('Starting graceful shutdown');

    try {
      // Shutdown modules
      logger.info('Shutting down modules');
      for (const [name, module] of this.modules) {
        try {
          await module.shutdown();
          logger.debug(`Module ${name} shutdown successfully`);
        } catch (error) {
          logger.error(`Failed to shutdown module ${name}`, { error: error.message });
        }
      }

      // Shutdown managers
      logger.info('Shutting down managers');
      
      if (this.rateLimiter) {
        await this.rateLimiter.shutdown();
      }
      
      if (this.permissionManager) {
        // Permission manager doesn't need shutdown
      }
      
      if (this.interactionHandler) {
        await this.interactionHandler.shutdown();
      }
      
      if (this.commandHandler) {
        await this.commandHandler.shutdown();
      }
      
      if (this.eventManager) {
        await this.eventManager.shutdown();
      }

      // Shutdown database
      if (this.database) {
        await this.database.close();
      }

      // Destroy Discord client
      if (this.ws && this.ws.status === 0) { // READY
        await this.destroy();
      }

      logger.info('Graceful shutdown completed');
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message });
    }
  }

  /**
   * Get bot statistics
   */
  getStats() {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    return {
      status: this.isReady ? 'ready' : 'initializing',
      uptime: Math.floor(uptime),
      uptimeFormatted: this.formatUptime(uptime),
      startupTime: this.startupTime,
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      },
      modules: {
        total: this.modules.size,
        enabled: Array.from(this.modules.values()).filter(m => m.enabled).length
      },
      commands: this.commandHandler ? this.commandHandler.getStatus() : null,
      events: this.eventManager ? this.eventManager.getStatus() : null,
      interactions: this.interactionHandler ? this.interactionHandler.getStatus() : null,
      permissions: this.permissionManager ? this.permissionManager.getStatus() : null,
      rateLimits: this.rateLimiter ? this.rateLimiter.getStats() : null
    };
  }

  /**
   * Format uptime to human readable format
   * @param {number} seconds - Uptime in seconds
   * @returns {string} Formatted uptime
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0) parts.push(`${secs}s`);

    return parts.join(' ') || '0s';
  }

  /**
   * Get module by name
   * @param {string} name - Module name
   * @returns {BaseModule|null}
   */
  getModule(name) {
    return this.modules.get(name) || null;
  }

  /**
   * Get all modules
   * @returns {Collection} All modules
   */
  getAllModules() {
    return this.modules;
  }

  /**
   * Enable module
   * @param {string} name - Module name
   */
  async enableModule(name) {
    const module = this.modules.get(name);
    if (!module) {
      logger.warn(`Module ${name} not found for enabling`);
      return;
    }

    module.enabled = true;
    await module.initialize();
    logger.info(`Enabled module: ${name}`);
  }

  /**
   * Disable module
   * @param {string} name - Module name
   */
  async disableModule(name) {
    const module = this.modules.get(name);
    if (!module) {
      logger.warn(`Module ${name} not found for disabling`);
      return;
    }

    await module.shutdown();
    module.enabled = false;
    logger.info(`Disabled module: ${name}`);
  }
}

module.exports = EyeDaemonClient;