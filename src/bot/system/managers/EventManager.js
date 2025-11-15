/**
 * EventManager Class
 * 
 * Manages Discord event handlers with automatic loading and custom event support.
 * Provides centralized event management for the bot.
 */

const fs = require('fs');
const path = require('path');

class EventManager {
    /**
     * Create a new EventManager instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.events = new Map();
        this.customEvents = new Map();
        this.logger = client.logger || console;
    }

    /**
     * Load all event handlers from a directory
     * @param {string} directory - Path to events directory
     * @returns {Promise<void>}
     */
    async loadEvents(directory) {
        try {
            this.log('Loading event handlers...', 'info');

            // Check if directory exists
            if (!fs.existsSync(directory)) {
                this.log(`Events directory not found: ${directory}`, 'warn');
                return;
            }

            // Read all files in the directory
            const files = fs.readdirSync(directory).filter(file => file.endsWith('.js'));

            if (files.length === 0) {
                this.log('No event files found', 'warn');
                return;
            }

            // Load each event file
            for (const file of files) {
                try {
                    const filePath = path.join(directory, file);
                    const EventClass = require(filePath);

                    // Instantiate the event class
                    const event = new EventClass(this.client);

                    // Validate event has required properties
                    if (!event.name) {
                        this.log(`Event ${file} missing 'name' property, skipping`, 'warn');
                        continue;
                    }

                    if (typeof event.execute !== 'function') {
                        this.log(`Event ${file} missing 'execute' method, skipping`, 'warn');
                        continue;
                    }

                    // Register the event
                    this.registerEvent(event);

                    this.log(`Loaded event: ${event.name} from ${file}`, 'info');
                } catch (error) {
                    this.log(`Failed to load event from ${file}: ${error.message}`, 'error', {
                        error: error.message,
                        stack: error.stack,
                    });
                }
            }

            this.log(`Loaded ${this.events.size} event handlers`, 'info');
        } catch (error) {
            this.log(`Failed to load events: ${error.message}`, 'error', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Register a single event handler
     * @param {Object} event - Event instance (must extend BaseEvent)
     * @returns {void}
     */
    registerEvent(event) {
        try {
            // Validate event
            if (!event.name) {
                throw new Error('Event must have a name property');
            }

            if (typeof event.execute !== 'function') {
                throw new Error('Event must have an execute method');
            }

            // Check if event is enabled
            if (event.isEnabled && !event.isEnabled()) {
                this.log(`Event ${event.name} is disabled, skipping registration`, 'debug');
                return;
            }

            // Store event in registry
            this.events.set(event.name, event);

            // Create event handler wrapper
            const eventHandler = async (...args) => {
                try {
                    // Check if event is still enabled
                    if (event.isEnabled && !event.isEnabled()) {
                        return;
                    }

                    // Execute the event handler
                    await event.execute(...args);
                } catch (error) {
                    // Use event's error handler if available
                    if (typeof event.handleError === 'function') {
                        await event.handleError(error, ...args);
                    } else {
                        this.log(`Error in event ${event.name}: ${error.message}`, 'error', {
                            event: event.name,
                            error: error.message,
                            stack: error.stack,
                        });
                    }
                }
            };

            // Register with Discord client
            if (event.once) {
                this.client.once(event.name, eventHandler);
                this.log(`Registered once event: ${event.name}`, 'debug');
            } else {
                this.client.on(event.name, eventHandler);
                this.log(`Registered event: ${event.name}`, 'debug');
            }
        } catch (error) {
            this.log(`Failed to register event: ${error.message}`, 'error', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Unregister an event handler
     * @param {string} eventName - Name of the event to unregister
     * @returns {boolean} True if event was unregistered, false if not found
     */
    unregisterEvent(eventName) {
        try {
            const event = this.events.get(eventName);

            if (!event) {
                this.log(`Event ${eventName} not found`, 'warn');
                return false;
            }

            // Remove all listeners for this event
            this.client.removeAllListeners(eventName);

            // Remove from registry
            this.events.delete(eventName);

            this.log(`Unregistered event: ${eventName}`, 'info');
            return true;
        } catch (error) {
            this.log(`Failed to unregister event ${eventName}: ${error.message}`, 'error', {
                error: error.message,
                stack: error.stack,
            });
            return false;
        }
    }

    /**
     * Emit a custom event
     * @param {string} eventName - Name of the custom event
     * @param {...any} args - Arguments to pass to event handlers
     * @returns {void}
     */
    emit(eventName, ...args) {
        try {
            // Get custom event handlers
            const handlers = this.customEvents.get(eventName) || [];

            if (handlers.length === 0) {
                this.log(`No handlers registered for custom event: ${eventName}`, 'debug');
                return;
            }

            this.log(`Emitting custom event: ${eventName}`, 'debug');

            // Execute all handlers
            for (const handler of handlers) {
                try {
                    handler(...args);
                } catch (error) {
                    this.log(`Error in custom event handler for ${eventName}: ${error.message}`, 'error', {
                        event: eventName,
                        error: error.message,
                        stack: error.stack,
                    });
                }
            }
        } catch (error) {
            this.log(`Failed to emit custom event ${eventName}: ${error.message}`, 'error', {
                error: error.message,
                stack: error.stack,
            });
        }
    }

    /**
     * Register a handler for a custom event
     * @param {string} eventName - Name of the custom event
     * @param {Function} handler - Handler function
     * @returns {void}
     */
    on(eventName, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }

        if (!this.customEvents.has(eventName)) {
            this.customEvents.set(eventName, []);
        }

        this.customEvents.get(eventName).push(handler);
        this.log(`Registered custom event handler: ${eventName}`, 'debug');
    }

    /**
     * Register a one-time handler for a custom event
     * @param {string} eventName - Name of the custom event
     * @param {Function} handler - Handler function
     * @returns {void}
     */
    once(eventName, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }

        const onceHandler = (...args) => {
            handler(...args);
            this.off(eventName, onceHandler);
        };

        this.on(eventName, onceHandler);
    }

    /**
     * Remove a handler for a custom event
     * @param {string} eventName - Name of the custom event
     * @param {Function} handler - Handler function to remove
     * @returns {boolean} True if handler was removed, false if not found
     */
    off(eventName, handler) {
        const handlers = this.customEvents.get(eventName);

        if (!handlers) {
            return false;
        }

        const index = handlers.indexOf(handler);

        if (index === -1) {
            return false;
        }

        handlers.splice(index, 1);

        if (handlers.length === 0) {
            this.customEvents.delete(eventName);
        }

        this.log(`Removed custom event handler: ${eventName}`, 'debug');
        return true;
    }

    /**
     * Get an event by name
     * @param {string} eventName - Name of the event
     * @returns {Object|null} Event instance or null if not found
     */
    getEvent(eventName) {
        return this.events.get(eventName) || null;
    }

    /**
     * Get all registered events
     * @returns {Map} Map of all registered events
     */
    getAllEvents() {
        return new Map(this.events);
    }

    /**
     * Check if an event is registered
     * @param {string} eventName - Name of the event
     * @returns {boolean} True if event is registered
     */
    hasEvent(eventName) {
        return this.events.has(eventName);
    }

    /**
     * Get count of registered events
     * @returns {number} Number of registered events
     */
    getEventCount() {
        return this.events.size;
    }

    /**
     * Reload an event handler
     * @param {string} eventName - Name of the event to reload
     * @param {string} filePath - Path to the event file
     * @returns {Promise<boolean>} True if reloaded successfully
     */
    async reloadEvent(eventName, filePath) {
        try {
            // Unregister existing event
            this.unregisterEvent(eventName);

            // Clear require cache
            delete require.cache[require.resolve(filePath)];

            // Load and register new event
            const EventClass = require(filePath);
            const event = new EventClass(this.client);

            this.registerEvent(event);

            this.log(`Reloaded event: ${eventName}`, 'info');
            return true;
        } catch (error) {
            this.log(`Failed to reload event ${eventName}: ${error.message}`, 'error', {
                error: error.message,
                stack: error.stack,
            });
            return false;
        }
    }

    /**
     * Log message with EventManager context
     * @param {string} message - Message to log
     * @param {string} level - Log level (info, warn, error, debug)
     * @param {Object} metadata - Additional metadata to log
     */
    log(message, level = 'info', metadata = {}) {
        const prefix = '[EventManager]';
        const logMessage = `${prefix} ${message}`;

        if (this.logger && typeof this.logger[level] === 'function') {
            if (Object.keys(metadata).length > 0) {
                this.logger[level](logMessage, metadata);
            } else {
                this.logger[level](logMessage);
            }
        } else {
            console[level](logMessage, metadata);
        }
    }

    /**
     * Cleanup all event handlers
     * @returns {void}
     */
    cleanup() {
        try {
            this.log('Cleaning up event handlers...', 'info');

            // Unregister all events
            for (const eventName of this.events.keys()) {
                this.unregisterEvent(eventName);
            }

            // Clear custom events
            this.customEvents.clear();

            this.log('Event handlers cleaned up', 'info');
        } catch (error) {
            this.log(`Failed to cleanup event handlers: ${error.message}`, 'error', {
                error: error.message,
                stack: error.stack,
            });
        }
    }
}

module.exports = EventManager;
