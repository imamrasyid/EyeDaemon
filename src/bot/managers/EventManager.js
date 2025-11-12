const { Collection } = require('discord.js');
const path = require('path');
const fs = require('fs');
const { events: logger } = require('../services/logging.service');

/**
 * Event Manager untuk mengelola semua Discord events
 */
class EventManager {
  constructor(client) {
    this.client = client;
    this.events = new Collection();
    this.eventHandlers = new Map();
    this.eventStats = new Map();
    this.enabled = true;
  }

  /**
   * Initialize event manager
   */
  async initialize() {
    logger.info('Initializing event manager');
    
    // Load built-in events
    await this.loadBuiltinEvents();
    
    // Load module events
    await this.loadModuleEvents();
    
    // Register all events
    await this.registerAllEvents();
    
    logger.info(`Event manager initialized with ${this.events.size} events`);
  }

  /**
   * Load built-in events from events directory
   */
  async loadBuiltinEvents() {
    const eventsDir = path.join(__dirname, '../events');
    
    if (!fs.existsSync(eventsDir)) {
      logger.warn('Events directory not found, creating it');
      fs.mkdirSync(eventsDir, { recursive: true });
      return;
    }

    const eventFiles = fs.readdirSync(eventsDir).filter(file => 
      file.endsWith('.js') && !file.startsWith('_')
    );

    for (const file of eventFiles) {
      try {
        const eventPath = path.join(eventsDir, file);
        const EventClass = require(eventPath);
        
        if (typeof EventClass !== 'function') {
          logger.warn(`Invalid event class in ${file}`);
          continue;
        }

        const event = new EventClass(this.client);
        
        if (!event.name || !event.execute) {
          logger.warn(`Invalid event structure in ${file}`);
          continue;
        }

        this.events.set(event.name, event);
        logger.debug(`Loaded built-in event: ${event.name}`);
        
      } catch (error) {
        logger.error(`Failed to load event ${file}`, { error: error.message });
      }
    }
  }

  /**
   * Load events from modules
   */
  async loadModuleEvents() {
    for (const [moduleName, module] of this.client.modules) {
      if (!module.enabled) continue;
      
      for (const [eventName, event] of module.events) {
        try {
          this.events.set(`${moduleName}.${eventName}`, event);
          logger.debug(`Loaded module event: ${moduleName}.${eventName}`);
        } catch (error) {
          logger.error(`Failed to load module event ${moduleName}.${eventName}`, { error: error.message });
        }
      }
    }
  }

  /**
   * Register all events with Discord.js client
   */
  async registerAllEvents() {
    for (const [name, event] of this.events) {
      if (!event.enabled) {
        logger.debug(`Skipping disabled event: ${name}`);
        continue;
      }

      try {
        await this.registerEvent(name, event);
      } catch (error) {
        logger.error(`Failed to register event ${name}`, { error: error.message });
      }
    }
  }

  /**
   * Register single event
   * @param {string} name - Event name
   * @param {BaseEvent} event - Event instance
   */
  async registerEvent(name, event) {
    const eventMethod = event.once ? 'once' : 'on';
    
    const handler = async (...args) => {
      const start = process.hrtime.bigint();
      
      try {
        // Update event stats
        this.updateEventStats(name, 'executed');
        
        // Validate event
        const validation = await event.validate(...args);
        if (!validation.valid) {
          logger.debug(`Event ${name} validation failed: ${validation.reason}`);
          return;
        }
        
        // Execute event
        await event.execute(...args);
        
        // Update success stats
        this.updateEventStats(name, 'success');
        
      } catch (error) {
        // Update error stats
        this.updateEventStats(name, 'error');
        
        logger.error(`Error in event ${name}`, {
          error: error.message,
          stack: error.stack,
          args: this.sanitizeEventArgs(args)
        });
        
        // Emit error event for monitoring
        this.client.emit('eventError', { name, error, args });
      } finally {
        const duration = Number(process.hrtime.bigint() - start) / 1000000;
        this.updateEventStats(name, 'duration', duration);
      }
    };

    // Store handler for later removal
    this.eventHandlers.set(name, handler);
    
    // Register with Discord.js client
    if (event.emitter) {
      event.emitter[eventMethod](event.eventName || name, handler);
    } else {
      this.client[eventMethod](event.eventName || name, handler);
    }
    
    logger.debug(`Registered event: ${name}`);
  }

  /**
   * Unregister specific event
   * @param {string} name - Event name
   */
  async unregisterEvent(name) {
    const event = this.events.get(name);
    const handler = this.eventHandlers.get(name);
    
    if (!event || !handler) {
      logger.warn(`Event ${name} not found for unregistration`);
      return;
    }

    try {
      const emitter = event.emitter || this.client;
      emitter.removeListener(event.eventName || name, handler);
      
      this.events.delete(name);
      this.eventHandlers.delete(name);
      this.eventStats.delete(name);
      
      logger.debug(`Unregistered event: ${name}`);
    } catch (error) {
      logger.error(`Failed to unregister event ${name}`, { error: error.message });
    }
  }

  /**
   * Reload specific event
   * @param {string} name - Event name
   */
  async reloadEvent(name) {
    await this.unregisterEvent(name);
    
    // For built-in events, reload from file
    if (!name.includes('.')) {
      const eventPath = path.join(__dirname, '../events', `${name}.js`);
      if (fs.existsSync(eventPath)) {
        delete require.cache[require.resolve(eventPath)];
        const EventClass = require(eventPath);
        const event = new EventClass(this.client);
        this.events.set(name, event);
        await this.registerEvent(name, event);
      }
    }
    
    logger.debug(`Reloaded event: ${name}`);
  }

  /**
   * Update event statistics
   * @param {string} name - Event name
   * @param {string} type - Statistic type
   * @param {any} value - Statistic value
   */
  updateEventStats(name, type, value = 1) {
    if (!this.eventStats.has(name)) {
      this.eventStats.set(name, {
        executed: 0,
        success: 0,
        error: 0,
        duration: 0,
        avgDuration: 0
      });
    }

    const stats = this.eventStats.get(name);
    
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
    
    this.eventStats.set(name, stats);
  }

  /**
   * Get event statistics
   * @param {string} name - Event name (optional)
   * @returns {Object} Event statistics
   */
  getEventStats(name = null) {
    if (name) {
      return this.eventStats.get(name) || null;
    }
    
    return Object.fromEntries(this.eventStats);
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
   * Get all events
   * @returns {Collection} All events
   */
  getAllEvents() {
    return this.events;
  }

  /**
   * Enable event
   * @param {string} name - Event name
   */
  async enableEvent(name) {
    const event = this.events.get(name);
    if (!event) {
      logger.warn(`Event ${name} not found for enabling`);
      return;
    }

    event.enabled = true;
    await this.registerEvent(name, event);
    logger.debug(`Enabled event: ${name}`);
  }

  /**
   * Disable event
   * @param {string} name - Event name
   */
  async disableEvent(name) {
    const event = this.events.get(name);
    if (!event) {
      logger.warn(`Event ${name} not found for disabling`);
      return;
    }

    event.enabled = false;
    await this.unregisterEvent(name);
    logger.debug(`Disabled event: ${name}`);
  }

  /**
   * Sanitize event arguments for logging
   * @param {Array} args - Event arguments
   * @returns {Array} Sanitized arguments
   */
  sanitizeEventArgs(args) {
    return args.map(arg => {
      if (arg && typeof arg === 'object') {
        // Remove sensitive data
        const sanitized = { ...arg };
        if (sanitized.token) sanitized.token = '[REDACTED]';
        if (sanitized.password) sanitized.password = '[REDACTED]';
        return sanitized;
      }
      return arg;
    });
  }

  /**
   * Get event manager status
   * @returns {Object} Status information
   */
  getStatus() {
    const totalEvents = this.events.size;
    const enabledEvents = Array.from(this.events.values()).filter(e => e.enabled).length;
    const totalExecutions = Array.from(this.eventStats.values()).reduce((sum, stats) => sum + stats.executed, 0);
    const totalErrors = Array.from(this.eventStats.values()).reduce((sum, stats) => sum + stats.error, 0);

    return {
      totalEvents,
      enabledEvents,
      disabledEvents: totalEvents - enabledEvents,
      totalExecutions,
      totalErrors,
      errorRate: totalExecutions > 0 ? (totalErrors / totalExecutions * 100).toFixed(2) + '%' : '0%',
      uptime: process.uptime(),
      enabled: this.enabled
    };
  }

  /**
   * Shutdown event manager
   */
  async shutdown() {
    logger.info('Shutting down event manager');
    
    // Unregister all events
    for (const [name] of this.events) {
      await this.unregisterEvent(name);
    }
    
    this.events.clear();
    this.eventHandlers.clear();
    this.eventStats.clear();
    
    logger.info('Event manager shutdown complete');
  }
}

module.exports = EventManager;