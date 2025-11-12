const CONFIG = require('../config');
const { createModuleLogger } = require('../services/logging.service');

/**
 * Base class for all bot modules
 */
class BaseModule {
  constructor(client, options = {}) {
    this.client = client;
    this.name = options.name;
    this.description = options.description || 'No description provided';
    this.version = options.version || '1.0.0';
    this.author = options.author || 'EyeDaemon';
    this.enabled = options.enabled !== false;
    this.category = options.category || 'General';
    this.dependencies = options.dependencies || [];
    this.commands = new Map();
    this.events = new Map();
    this.interactions = new Map();
    this.repositories = new Map();
    this.services = new Map();
    this.logger = createModuleLogger(this.name.toUpperCase());
  }

  /**
   * Initialize the module
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.logger.info(`Initializing ${this.name} module v${this.version}`);
      
      // Check dependencies
      await this.checkDependencies();
      
      // Initialize module-specific services
      await this.initializeServices();
      
      // Register commands
      await this.registerCommands();
      
      // Register events
      await this.registerEvents();
      
      // Register interactions
      await this.registerInteractions();
      
      // Run module-specific initialization
      await this.onInitialize();
      
      this.logger.info(`${this.name} module initialized successfully`);
    } catch (error) {
      this.logger.error(`Failed to initialize ${this.name} module`, { error: error.message });
      throw error;
    }
  }

  /**
   * Check module dependencies
   * @returns {Promise<void>}
   */
  async checkDependencies() {
    for (const dependency of this.dependencies) {
      // Support service dependency 'Database'
      if (dependency === 'Database') {
        if (!this.client.database) {
          throw new Error(`Required dependency 'Database' not found for module '${this.name}'`);
        }
        continue;
      }

      if (!this.client.modules.has(dependency)) {
        throw new Error(`Required dependency '${dependency}' not found for module '${this.name}'`);
      }
    }
  }

  /**
   * Initialize module services
   * @returns {Promise<void>}
   */
  async initializeServices() {
    // Override in subclasses
  }

  /**
   * Register module commands
   * @returns {Promise<void>}
   */
  async registerCommands() {
    // Override in subclasses
  }

  /**
   * Register module events
   * @returns {Promise<void>}
   */
  async registerEvents() {
    // Override in subclasses
  }

  /**
   * Register module interactions
   * @returns {Promise<void>}
   */
  async registerInteractions() {
    // Override in subclasses
  }

  /**
   * Module-specific initialization
   * @returns {Promise<void>}
   */
  async onInitialize() {
    // Override in subclasses
  }

  /**
   * Shutdown the module
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      this.logger.info(`Shutting down ${this.name} module`);
      
      // Unregister events
      await this.unregisterEvents();
      
      // Cleanup services
      await this.cleanupServices();
      
      // Run module-specific cleanup
      await this.onShutdown();
      
      this.logger.info(`${this.name} module shutdown successfully`);
    } catch (error) {
      this.logger.error(`Error during ${this.name} module shutdown`, { error: error.message });
      throw error;
    }
  }

  /**
   * Unregister module events
   * @returns {Promise<void>}
   */
  async unregisterEvents() {
    for (const [name, event] of this.events) {
      if (event.unregister) {
        event.unregister();
      }
    }
  }

  /**
   * Cleanup module services
   * @returns {Promise<void>}
   */
  async cleanupServices() {
    for (const [name, service] of this.services) {
      if (service.cleanup) {
        await service.cleanup();
      }
    }
  }

  /**
   * Module-specific cleanup
   * @returns {Promise<void>}
   */
  async onShutdown() {
    // Override in subclasses
  }

  /**
   * Add command to module
   * @param {BaseCommand} command - Command instance
   */
  addCommand(command) {
    this.commands.set(command.name, command);
    this.logger.debug(`Added command: ${command.name}`);
  }

  /**
   * Add event to module
   * @param {BaseEvent} event - Event instance
   */
  addEvent(event) {
    this.events.set(event.name, event);
    if (event.register) {
      event.register();
    }
    this.logger.debug(`Added event: ${event.name}`);
  }

  /**
   * Add interaction to module
   * @param {BaseInteraction} interaction - Interaction instance
   */
  addInteraction(interaction) {
    this.interactions.set(interaction.name, interaction);
    this.logger.debug(`Added interaction: ${interaction.name}`);
  }

  /**
   * Add repository to module
   * @param {string} name - Repository name
   * @param {Object} repository - Repository instance
   */
  addRepository(name, repository) {
    this.repositories.set(name, repository);
    this.logger.debug(`Added repository: ${name}`);
  }

  /**
   * Add service to module
   * @param {string} name - Service name
   * @param {Object} service - Service instance
   */
  addService(name, service) {
    this.services.set(name, service);
    this.logger.debug(`Added service: ${name}`);
  }

  /**
   * Get command by name
   * @param {string} name - Command name
   * @returns {BaseCommand|null}
   */
  getCommand(name) {
    return this.commands.get(name) || null;
  }

  /**
   * Get event by name
   * @param {string} name - Event name
   * @returns {BaseEvent|null}
   */
  getEvent(name) {
    return this.events.get(name) || null;
  }

  /**
   * Get interaction by name
   * @param {string} name - Interaction name
   * @returns {BaseInteraction|null}
   */
  getInteraction(name) {
    return this.interactions.get(name) || null;
  }

  /**
   * Get repository by name
   * @param {string} name - Repository name
   * @returns {Object|null}
   */
  getRepository(name) {
    return this.repositories.get(name) || null;
  }

  /**
   * Get service by name
   * @param {string} name - Service name
   * @returns {Object|null}
   */
  getService(name) {
    return this.services.get(name) || null;
  }

  /**
   * Get module information
   * @returns {Object} Module information
   */
  getInfo() {
    return {
      name: this.name,
      description: this.description,
      version: this.version,
      author: this.author,
      enabled: this.enabled,
      category: this.category,
      commands: Array.from(this.commands.keys()),
      events: Array.from(this.events.keys()),
      interactions: Array.from(this.interactions.keys()),
      services: Array.from(this.services.keys()),
      repositories: Array.from(this.repositories.keys())
    };
  }

  /**
   * Check if module has feature
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  hasFeature(feature) {
    const featureConfig = CONFIG.FEATURES[feature.toUpperCase()];
    return featureConfig !== undefined ? featureConfig : true;
  }

  /**
   * Get module statistics
   * @returns {Object} Module statistics
   */
  getStats() {
    return {
      name: this.name,
      commands: this.commands.size,
      events: this.events.size,
      interactions: this.interactions.size,
      services: this.services.size,
      repositories: this.repositories.size,
      enabled: this.enabled,
      uptime: process.uptime()
    };
  }
}

module.exports = BaseModule;
