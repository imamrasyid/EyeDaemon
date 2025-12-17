/**
 * Developer Tools Service
 *
 * Provides hot reload hooks, plugin registry, and middleware hooks (lightweight stubs).
 */

const logger = require('../helpers/logger_helper');

class DeveloperToolsService {
    constructor(client) {
        this.client = client;
        this.plugins = new Map();
        this.middlewares = [];
    }

    register_plugin(name, plugin_fn) {
        this.plugins.set(name, plugin_fn);
        logger.info(`Registered plugin: ${name}`);
    }

    async run_plugins(context = {}) {
        for (const [name, fn] of this.plugins.entries()) {
            try {
                await fn(context);
            } catch (error) {
                logger.warn('Plugin execution failed', { name, error: error.message });
            }
        }
    }

    use_middleware(fn) {
        this.middlewares.push(fn);
    }

    async run_middlewares(context = {}) {
        for (const mw of this.middlewares) {
            try {
                await mw(context);
            } catch (error) {
                logger.warn('Middleware failed', { error: error.message });
            }
        }
    }

    // Placeholder hot reload hook
    async hot_reload() {
        logger.info('Hot reload triggered (stub). Implement file watcher if needed.');
    }
}

module.exports = DeveloperToolsService;
