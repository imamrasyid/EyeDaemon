/**
 * Base class for all bot events
 */
class BaseEvent {
  constructor(client, options = {}) {
    this.client = client;
    this.name = options.name;
    this.description = options.description || 'No description provided';
    this.once = options.once || false;
    this.enabled = options.enabled !== false;
    this.category = options.category || 'General';
  }

  /**
   * Execute the event
   * @param {...any} args - Event arguments
   * @returns {Promise<void>}
   */
  async execute(...args) {
    throw new Error('Execute method must be implemented by subclass');
  }

  /**
   * Validate event execution
   * @param {...any} args - Event arguments
   * @returns {Object} Validation result
   */
  async validate(...args) {
    const result = {
      valid: true,
      reason: null
    };

    // Check if event is enabled
    if (!this.enabled) {
      result.valid = false;
      result.reason = 'Event is currently disabled';
      return result;
    }

    return result;
  }

  /**
   * Get event information
   * @returns {Object} Event information
   */
  getInfo() {
    return {
      name: this.name,
      description: this.description,
      category: this.category,
      once: this.once,
      enabled: this.enabled
    };
  }

  /**
   * Format error message for event
   * @param {string} message - Error message
   * @param {...any} args - Event arguments
   * @returns {Object} Formatted error information
   */
  formatError(message, ...args) {
    return {
      event: this.name,
      message,
      args: args.length > 0 ? args.map(arg => this.safeStringify(arg)) : [],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Safely stringify objects for logging
   * @param {any} obj - Object to stringify
   * @returns {string} Stringified object
   */
  safeStringify(obj) {
    try {
      return JSON.stringify(obj, (key, value) => {
        // Skip circular references and sensitive data
        if (key === 'token' || key === 'password') return '[REDACTED]';
        return value;
      }, 2);
    } catch (error) {
      return `[Stringify Error: ${error.message}]`;
    }
  }
}

/**
 * Base class for Discord.js events
 */
class BaseDiscordEvent extends BaseEvent {
  constructor(client, options = {}) {
    super(client, options);
    this.eventName = options.eventName;
    this.emitter = options.emitter || client;
  }

  /**
   * Execute the Discord event
   * @param {...any} args - Discord event arguments
   * @returns {Promise<void>}
   */
  async execute(...args) {
    throw new Error('Execute method must be implemented by subclass');
  }

  /**
   * Register the event with Discord.js client
   */
  register() {
    const eventMethod = this.once ? 'once' : 'on';
    this.emitter[eventMethod](this.eventName, (...args) => {
      this.execute(...args).catch(error => {
        console.error(`Error in event ${this.name}:`, error);
      });
    });
  }

  /**
   * Unregister the event from Discord.js client
   */
  unregister() {
    this.emitter.removeListener(this.eventName, this.execute);
  }
}

module.exports = {
  BaseEvent,
  BaseDiscordEvent
};