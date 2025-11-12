/**
 * Base class for all bot interactions
 */
class BaseInteraction {
  constructor(client, options = {}) {
    this.client = client;
    this.name = options.name;
    this.description = options.description || 'No description provided';
    this.enabled = options.enabled !== false;
    this.category = options.category || 'General';
  }

  /**
   * Execute the interaction
   * @param {Interaction} interaction - Discord interaction object
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    throw new Error('Execute method must be implemented by subclass');
  }

  /**
   * Validate interaction execution
   * @param {Interaction} interaction - Discord interaction object
   * @returns {Object} Validation result
   */
  async validate(interaction) {
    const result = {
      valid: true,
      reason: null
    };

    // Check if interaction is enabled
    if (!this.enabled) {
      result.valid = false;
      result.reason = 'Interaction is currently disabled';
      return result;
    }

    return result;
  }

  /**
   * Get interaction information
   * @returns {Object} Interaction information
   */
  getInfo() {
    return {
      name: this.name,
      description: this.description,
      category: this.category,
      enabled: this.enabled
    };
  }

  /**
   * Format error response
   * @param {string} message - Error message
   * @param {boolean} ephemeral - Whether to send as ephemeral message
   * @returns {Object} Formatted error response
   */
  formatError(message, ephemeral = true) {
    return {
      embeds: [{
        color: 0xff0000,
        title: '❌ Error',
        description: message,
        timestamp: new Date()
      }],
      ephemeral
    };
  }

  /**
   * Format success response
   * @param {string} message - Success message
   * @param {boolean} ephemeral - Whether to send as ephemeral message
   * @returns {Object} Formatted success response
   */
  formatSuccess(message, ephemeral = false) {
    return {
      embeds: [{
        color: 0x00ff00,
        title: '✅ Success',
        description: message,
        timestamp: new Date()
      }],
      ephemeral
    };
  }

  /**
   * Defer interaction response
   * @param {Interaction} interaction - Discord interaction object
   * @param {boolean} ephemeral - Whether to send as ephemeral message
   * @returns {Promise<void>}
   */
  async defer(interaction, ephemeral = false) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral });
    }
  }

  /**
   * Edit interaction response
   * @param {Interaction} interaction - Discord interaction object
   * @param {Object} options - Response options
   * @returns {Promise<void>}
   */
  async edit(interaction, options) {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(options);
    } else {
      await interaction.reply(options);
    }
  }

  /**
   * Follow up interaction response
   * @param {Interaction} interaction - Discord interaction object
   * @param {Object} options - Follow up options
   * @returns {Promise<void>}
   */
  async followUp(interaction, options) {
    await interaction.followUp(options);
  }
}

/**
 * Base class for button interactions
 */
class BaseButtonInteraction extends BaseInteraction {
  constructor(client, options = {}) {
    super(client, options);
    this.customId = options.customId;
    this.style = options.style || 'PRIMARY';
    this.label = options.label;
    this.emoji = options.emoji;
    this.disabled = options.disabled || false;
  }

  /**
   * Execute the button interaction
   * @param {ButtonInteraction} interaction - Discord button interaction object
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    throw new Error('Execute method must be implemented by subclass');
  }
}

/**
 * Base class for select menu interactions
 */
class BaseSelectMenuInteraction extends BaseInteraction {
  constructor(client, options = {}) {
    super(client, options);
    this.customId = options.customId;
    this.placeholder = options.placeholder || 'Select an option';
    this.minValues = options.minValues || 1;
    this.maxValues = options.maxValues || 1;
    this.disabled = options.disabled || false;
    this.options = options.options || [];
  }

  /**
   * Execute the select menu interaction
   * @param {SelectMenuInteraction} interaction - Discord select menu interaction object
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    throw new Error('Execute method must be implemented by subclass');
  }
}

/**
 * Base class for modal interactions
 */
class BaseModalInteraction extends BaseInteraction {
  constructor(client, options = {}) {
    super(client, options);
    this.customId = options.customId;
    this.title = options.title || 'Modal';
    this.components = options.components || [];
  }

  /**
   * Execute the modal interaction
   * @param {ModalSubmitInteraction} interaction - Discord modal interaction object
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    throw new Error('Execute method must be implemented by subclass');
  }
}

module.exports = {
  BaseInteraction,
  BaseButtonInteraction,
  BaseSelectMenuInteraction,
  BaseModalInteraction
};