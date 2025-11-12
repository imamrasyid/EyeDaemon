const { Collection } = require('discord.js');
const path = require('path');
const fs = require('fs');
const { interactions: logger } = require('../services/logging.service');

/**
 * Interaction Handler untuk mengelola semua Discord interactions
 */
class InteractionHandler {
  constructor(client) {
    this.client = client;
    this.interactions = new Collection();
    this.interactionStats = new Map();
    this.componentHandlers = new Map();
    this.modalHandlers = new Map();
    this.enabled = true;
  }

  /**
   * Initialize interaction handler
   */
  async initialize() {
    logger.info('Initializing interaction handler');
    
    // Load built-in interactions
    await this.loadBuiltinInteractions();
    
    // Load module interactions
    await this.loadModuleInteractions();
    
    logger.info(`Interaction handler initialized with ${this.interactions.size} interactions`);
  }

  /**
   * Load built-in interactions from interactions directory
   */
  async loadBuiltinInteractions() {
    const interactionsDir = path.join(__dirname, '../interactions');
    
    if (!fs.existsSync(interactionsDir)) {
      logger.warn('Interactions directory not found, creating it');
      fs.mkdirSync(interactionsDir, { recursive: true });
      return;
    }

    // Load different types of interactions
    const interactionTypes = ['buttons', 'selectMenus', 'modals'];
    
    for (const type of interactionTypes) {
      const typeDir = path.join(interactionsDir, type);
      
      if (!fs.existsSync(typeDir)) {
        fs.mkdirSync(typeDir, { recursive: true });
        continue;
      }

      const interactionFiles = fs.readdirSync(typeDir).filter(file => 
        file.endsWith('.js') && !file.startsWith('_')
      );

      for (const file of interactionFiles) {
        try {
          const interactionPath = path.join(typeDir, file);
          const InteractionClass = require(interactionPath);
          
          if (typeof InteractionClass !== 'function') {
            logger.warn(`Invalid interaction class in ${file}`);
            continue;
          }

          const interaction = new InteractionClass(this.client);
          
          if (!interaction.name || !interaction.execute) {
            logger.warn(`Invalid interaction structure in ${file}`);
            continue;
          }

          await this.registerInteraction(interaction);
          logger.debug(`Loaded built-in ${type} interaction: ${interaction.name}`);
          
        } catch (error) {
          logger.error(`Failed to load ${type} interaction ${file}`, { error: error.message });
        }
      }
    }
  }

  /**
   * Load interactions from modules
   */
  async loadModuleInteractions() {
    for (const [moduleName, module] of this.client.modules) {
      if (!module.enabled) continue;
      
      for (const [interactionName, interaction] of module.interactions) {
        try {
          await this.registerInteraction(interaction);
          logger.debug(`Loaded module interaction: ${moduleName}.${interactionName}`);
        } catch (error) {
          logger.error(`Failed to load module interaction ${moduleName}.${interactionName}`, { error: error.message });
        }
      }
    }
  }

  /**
   * Register an interaction
   * @param {BaseInteraction} interaction - Interaction instance
   */
  async registerInteraction(interaction) {
    if (!interaction.customId) {
      throw new Error('Interaction must have a customId');
    }

    // Check for duplicate customIds
    if (this.interactions.has(interaction.customId)) {
      throw new Error(`Interaction with customId '${interaction.customId}' is already registered`);
    }

    // Register interaction
    this.interactions.set(interaction.customId, interaction);

    // Initialize stats
    if (!this.interactionStats.has(interaction.customId)) {
      this.interactionStats.set(interaction.customId, {
        executed: 0,
        success: 0,
        error: 0,
        duration: 0,
        avgDuration: 0
      });
    }

    logger.debug(`Registered interaction: ${interaction.customId}`);
  }

  /**
   * Unregister an interaction
   * @param {string} customId - Interaction customId
   */
  async unregisterInteraction(customId) {
    const interaction = this.interactions.get(customId);
    if (!interaction) {
      logger.warn(`Interaction ${customId} not found for unregistration`);
      return;
    }

    this.interactions.delete(customId);
    this.interactionStats.delete(customId);

    logger.debug(`Unregistered interaction: ${customId}`);
  }

  /**
   * Handle incoming interaction
   * @param {Interaction} interaction - Discord interaction object
   */
  async handleInteraction(interaction) {
    if (!this.enabled) return;

    const start = process.hrtime.bigint();
    const customId = interaction.customId;

    try {
      // Update stats
      this.updateInteractionStats(customId, 'executed');

      // Find interaction handler
      const handler = this.findInteractionHandler(interaction);
      if (!handler) {
        logger.warn(`No handler found for interaction: ${customId}`);
        return;
      }

      // Validate interaction
      const validation = await handler.validate(interaction);
      if (!validation.valid) {
        logger.debug(`Interaction ${customId} validation failed: ${validation.reason}`);
        
        if (interaction.isRepliable()) {
          await interaction.reply(handler.formatError(validation.reason));
        }
        return;
      }

      // Execute interaction
      await handler.execute(interaction);

      // Update success stats
      this.updateInteractionStats(customId, 'success');

      logger.info(`Interaction executed: ${customId} by ${interaction.user.tag}`);

    } catch (error) {
      // Update error stats
      this.updateInteractionStats(customId, 'error');

      logger.error(`Interaction execution failed: ${customId}`, {
        error: error.message,
        user: interaction.user.tag,
        guild: interaction.guild?.name || 'DM'
      });

      // Send error message to user
      try {
        if (interaction.isRepliable()) {
          await interaction.reply({
            embeds: [{
              color: 0xff0000,
              title: '❌ Interaction Error',
              description: 'An error occurred while processing this interaction. Please try again.',
              timestamp: new Date()
            }],
            ephemeral: true
          });
        }
      } catch (replyError) {
        logger.error('Failed to send interaction error message', { error: replyError.message });
      }

      // Emit interaction error event
      this.client.emit('interactionError', { customId, interaction, error });
    } finally {
      const duration = Number(process.hrtime.bigint() - start) / 1000000;
      this.updateInteractionStats(customId, 'duration', duration);
    }
  }

  /**
   * Find interaction handler based on interaction type
   * @param {Interaction} interaction - Discord interaction object
   * @returns {BaseInteraction|null}
   */
  findInteractionHandler(interaction) {
    if (interaction.isButton()) {
      return this.interactions.get(interaction.customId) || null;
    }
    
    if (typeof interaction.isSelectMenu === 'function' ? interaction.isSelectMenu() : interaction.isStringSelectMenu()) {
      return this.interactions.get(interaction.customId) || null;
    }
    
    if (interaction.isModalSubmit()) {
      return this.interactions.get(interaction.customId) || null;
    }

    return null;
  }

  /**
   * Update interaction statistics
   * @param {string} customId - Interaction customId
   * @param {string} type - Statistic type
   * @param {any} value - Statistic value
   */
  updateInteractionStats(customId, type, value = 1) {
    if (!this.interactionStats.has(customId)) {
      this.interactionStats.set(customId, {
        executed: 0,
        success: 0,
        error: 0,
        duration: 0,
        avgDuration: 0
      });
    }

    const stats = this.interactionStats.get(customId);
    
    switch (type) {
      case 'executed':
        stats.executed += value;
        break;
      case 'success':
        stats.success += value;
        break;
      case 'error':
        stats.error += value;
        break;
      case 'duration':
        stats.duration += value;
        stats.avgDuration = stats.duration / stats.executed;
        break;
    }
    
    this.interactionStats.set(customId, stats);
  }

  /**
   * Get interaction statistics
   * @param {string} customId - Interaction customId (optional)
   * @returns {Object} Interaction statistics
   */
  getInteractionStats(customId = null) {
    if (customId) {
      return this.interactionStats.get(customId) || null;
    }
    
    return Object.fromEntries(this.interactionStats);
  }

  /**
   * Get interaction by customId
   * @param {string} customId - Interaction customId
   * @returns {BaseInteraction|null}
   */
  getInteraction(customId) {
    return this.interactions.get(customId) || null;
  }

  /**
   * Get all interactions
   * @returns {Collection} All interactions
   */
  getAllInteractions() {
    return this.interactions;
  }

  /**
   * Get interactions by type
   * @param {string} type - Interaction type (button, selectMenu, modal)
   * @returns {Array} Interactions of specified type
   */
  getInteractionsByType(type) {
    return Array.from(this.interactions.values()).filter(interaction => {
      switch (type) {
        case 'button':
          return interaction.constructor.name.includes('Button');
        case 'selectMenu':
          return interaction.constructor.name.includes('SelectMenu');
        case 'modal':
          return interaction.constructor.name.includes('Modal');
        default:
          return false;
      }
    });
  }

  /**
   * Reload specific interaction
   * @param {string} customId - Interaction customId
   */
  async reloadInteraction(customId) {
    const interaction = this.interactions.get(customId);
    if (!interaction) {
      logger.warn(`Interaction ${customId} not found for reloading`);
      return;
    }

    // Find interaction file
    const interactionTypes = ['buttons', 'selectMenus', 'modals'];
    let found = false;

    for (const type of interactionTypes) {
      const interactionPath = path.join(__dirname, '../interactions', type, `${interaction.name}.js`);
      if (fs.existsSync(interactionPath)) {
        // Unregister old interaction
        await this.unregisterInteraction(customId);

        // Reload interaction
        delete require.cache[require.resolve(interactionPath)];
        const InteractionClass = require(interactionPath);
        const newInteraction = new InteractionClass(this.client);

        // Register new interaction
        await this.registerInteraction(newInteraction);
        
        logger.debug(`Reloaded interaction: ${customId}`);
        found = true;
        break;
      }
    }

    if (!found) {
      logger.warn(`Interaction file not found for ${customId}`);
    }
  }

  /**
   * Enable interaction
   * @param {string} customId - Interaction customId
   */
  async enableInteraction(customId) {
    const interaction = this.interactions.get(customId);
    if (!interaction) {
      logger.warn(`Interaction ${customId} not found for enabling`);
      return;
    }

    interaction.enabled = true;
    logger.debug(`Enabled interaction: ${customId}`);
  }

  /**
   * Disable interaction
   * @param {string} customId - Interaction customId
   */
  async disableInteraction(customId) {
    const interaction = this.interactions.get(customId);
    if (!interaction) {
      logger.warn(`Interaction ${customId} not found for disabling`);
      return;
    }

    interaction.enabled = false;
    logger.debug(`Disabled interaction: ${customId}`);
  }

  /**
   * Create button interaction
   * @param {string} customId - Button customId
   * @param {Object} options - Button options
   * @returns {Object} Button component
   */
  createButton(customId, options = {}) {
    return {
      type: 2, // BUTTON
      custom_id: customId,
      style: options.style || 1, // PRIMARY
      label: options.label || 'Button',
      emoji: options.emoji,
      disabled: options.disabled || false,
      url: options.url
    };
  }

  /**
   * Create select menu interaction
   * @param {string} customId - Select menu customId
   * @param {Array} options - Select options
   * @param {Object} config - Select menu configuration
   * @returns {Object} Select menu component
   */
  createSelectMenu(customId, options = [], config = {}) {
    return {
      type: 3, // SELECT_MENU
      custom_id: customId,
      placeholder: config.placeholder || 'Select an option',
      min_values: config.minValues || 1,
      max_values: config.maxValues || 1,
      disabled: config.disabled || false,
      options: options.map((option, index) => ({
        label: option.label,
        value: option.value || `option_${index}`,
        description: option.description,
        emoji: option.emoji,
        default: option.default || false
      }))
    };
  }

  /**
   * Create modal interaction
   * @param {string} customId - Modal customId
   * @param {string} title - Modal title
   * @param {Array} components - Modal components
   * @returns {Object} Modal component
   */
  createModal(customId, title, components = []) {
    return {
      type: 9, // MODAL
      custom_id: customId,
      title: title || 'Modal',
      components: components.map((component, index) => ({
        type: 1, // ACTION_ROW
        components: [{
          type: 4, // TEXT_INPUT
          custom_id: component.customId || `input_${index}`,
          style: component.style || 1, // SHORT
          label: component.label || `Input ${index + 1}`,
          placeholder: component.placeholder,
          min_length: component.minLength,
          max_length: component.maxLength,
          required: component.required !== false,
          value: component.value
        }]
      }))
    };
  }

  /**
   * Get interaction handler status
   * @returns {Object} Status information
   */
  getStatus() {
    const totalInteractions = this.interactions.size;
    const enabledInteractions = Array.from(this.interactions.values()).filter(i => i.enabled).length;
    const totalExecutions = Array.from(this.interactionStats.values()).reduce((sum, stats) => sum + stats.executed, 0);
    const totalErrors = Array.from(this.interactionStats.values()).reduce((sum, stats) => sum + stats.error, 0);

    return {
      totalInteractions,
      enabledInteractions,
      disabledInteractions: totalInteractions - enabledInteractions,
      totalExecutions,
      totalErrors,
      errorRate: totalExecutions > 0 ? (totalErrors / totalExecutions * 100).toFixed(2) + '%' : '0%',
      enabled: this.enabled
    };
  }

  /**
   * Shutdown interaction handler
   */
  async shutdown() {
    logger.info('Shutting down interaction handler');
    
    this.interactions.clear();
    this.interactionStats.clear();
    this.componentHandlers.clear();
    this.modalHandlers.clear();
    
    logger.info('Interaction handler shutdown complete');
  }
}

module.exports = InteractionHandler;