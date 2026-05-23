/**
 * ServiceContainer
 * 
 * Dependency injection container for managing service lifecycle and dependencies.
 * Provides automatic dependency resolution, singleton management, and lifecycle hooks.
 */

const logger = require('../helpers/LoggerHelper');

class ServiceContainer {
    /**
     * Create a new ServiceContainer instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.services = new Map();
        this.singletons = new Map();
        this.factories = new Map();
        this.dependencies = new Map();
        this.initialized = new Set();
    }

    /**
     * Register a service as a singleton
     * @param {string} name - Service name
     * @param {Function} factory - Factory function to create the service
     * @param {Array<string>} deps - Array of dependency names
     */
    registerSingleton(name, factory, deps = []) {
        this.services.set(name, { type: 'singleton', factory, deps });
        this.dependencies.set(name, deps);
        logger.debug(`Registered singleton service: ${name}`);
    }

    /**
     * Register a service as a factory (creates new instance each time)
     * @param {string} name - Service name
     * @param {Function} factory - Factory function to create the service
     * @param {Array<string>} deps - Array of dependency names
     */
    registerFactory(name, factory, deps = []) {
        this.services.set(name, { type: 'factory', factory, deps });
        this.dependencies.set(name, deps);
        logger.debug(`Registered factory service: ${name}`);
    }

    /**
     * Register an already instantiated service
     * @param {string} name - Service name
     * @param {Object} instance - Service instance
     */
    registerInstance(name, instance) {
        this.singletons.set(name, instance);
        this.initialized.add(name);
        logger.debug(`Registered instance: ${name}`);
    }

    /**
     * Get a service by name
     * @param {string} name - Service name
     * @returns {Object} Service instance
     */
    get(name) {
        // Check if already instantiated
        if (this.singletons.has(name)) {
            return this.singletons.get(name);
        }

        // Check if service is registered
        if (!this.services.has(name)) {
            throw new Error(`Service '${name}' is not registered`);
        }

        const service = this.services.get(name);

        // Resolve dependencies
        const deps = this.dependencies.get(name) || [];
        const resolvedDeps = deps.map(dep => this.get(dep));

        // Create instance
        const instance = service.factory(...resolvedDeps);

        // Store if singleton
        if (service.type === 'singleton') {
            this.singletons.set(name, instance);
            this.initialized.add(name);
        }

        return instance;
    }

    /**
     * Check if a service is registered
     * @param {string} name - Service name
     * @returns {boolean} True if registered
     */
    has(name) {
        return this.services.has(name) || this.singletons.has(name);
    }

    /**
     * Initialize all registered services in dependency order
     * @returns {Promise<void>}
     */
    async initializeAll() {
        logger.info('Initializing services...');

        const serviceNames = Array.from(this.services.keys());
        const initializedOrder = this.getInitializationOrder(serviceNames);

        for (const name of initializedOrder) {
            await this.initializeService(name);
        }

        logger.info(`Initialized ${this.initialized.size} services`);
    }

    /**
     * Initialize a specific service
     * @param {string} name - Service name
     * @returns {Promise<void>}
     */
    async initializeService(name) {
        if (this.initialized.has(name)) {
            return;
        }

        // Get service instance (this will trigger initialization of dependencies)
        const instance = this.get(name);

        // Call initialize method if it exists
        if (instance && typeof instance.initialize === 'function') {
            await instance.initialize();
            this.initialized.add(name);
            logger.debug(`Initialized service: ${name}`);
        } else {
            this.initialized.add(name);
        }
    }

    /**
     * Get initialization order based on dependencies (topological sort)
     * @private
     * @param {Array<string>} serviceNames - Array of service names
     * @returns {Array<string>} Ordered service names
     */
    getInitializationOrder(serviceNames) {
        const visited = new Set();
        const temp = new Set();
        const order = [];

        const visit = (name) => {
            if (temp.has(name)) {
                throw new Error(`Circular dependency detected involving: ${name}`);
            }
            if (visited.has(name)) {
                return;
            }

            temp.add(name);
            const deps = this.dependencies.get(name) || [];
            for (const dep of deps) {
                visit(dep);
            }
            temp.delete(name);
            visited.add(name);
            order.push(name);
        };

        for (const name of serviceNames) {
            visit(name);
        }

        return order;
    }

    /**
     * Shutdown all initialized services in reverse order
     * @returns {Promise<void>}
     */
    async shutdownAll() {
        logger.info('Shutting down services...');

        const serviceNames = Array.from(this.initialized).reverse();

        for (const name of serviceNames) {
            await this.shutdownService(name);
        }

        logger.info('All services shut down');
    }

    /**
     * Shutdown a specific service
     * @param {string} name - Service name
     * @returns {Promise<void>}
     */
    async shutdownService(name) {
        const instance = this.singletons.get(name);

        if (instance && typeof instance.shutdown === 'function') {
            try {
                await instance.shutdown();
                logger.debug(`Shutdown service: ${name}`);
            } catch (error) {
                logger.error(`Error shutting down service ${name}`, {
                    error: error.message,
                });
            }
        }

        this.initialized.delete(name);
    }

    /**
     * Clear all services
     */
    clear() {
        this.services.clear();
        this.singletons.clear();
        this.factories.clear();
        this.dependencies.clear();
        this.initialized.clear();
        logger.debug('Service container cleared');
    }

    /**
     * Get all registered service names
     * @returns {Array<string>} Array of service names
     */
    getRegisteredServices() {
        return Array.from(this.services.keys());
    }

    /**
     * Get all initialized service names
     * @returns {Array<string>} Array of initialized service names
     */
    getInitializedServices() {
        return Array.from(this.initialized);
    }
}

module.exports = ServiceContainer;
