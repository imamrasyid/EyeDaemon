/**
 * ModuleLoader
 * 
 * Handles loading of modules, controllers, and services.
 */

const logger = require('../helpers/LoggerHelper');

class ModuleLoader {
    /**
     * Create a new ModuleLoader instance
     * @param {Object} bot - Bot instance
     */
    constructor(bot) {
        this.bot = bot;
    }

    /**
     * Load all modules and their controllers
     * @returns {Promise<void>}
     */
    async loadModules() {
        try {
            logger.info('Loading modules...');

            // Load global services first (before modules)
            await this.loadGlobalServices();

            // List of modules to load (based on feature flags)
            const modulesToLoad = this.getModulesToLoad();

            // Load each module
            for (const moduleName of modulesToLoad) {
                await this.loadModule(moduleName);
            }

            logger.info(`Loaded ${this.bot.modules.size} modules with ${this.bot.services.size} services and ${this.bot.controllers.size} controllers`);

            // Validate command methods after all modules are loaded
            this.validateCommandMethods();
        } catch (error) {
            logger.error('Failed to load modules', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Get list of modules to load based on feature flags
     * @private
     * @returns {Array<string>} List of module names
     */
    getModulesToLoad() {
        const config = require('../../application/config/config');
        const modulesToLoad = [];

        if (config.features.music) {
            modulesToLoad.push('music');
        }

        if (config.features.economy) {
            modulesToLoad.push('economy');
        }

        if (config.features.leveling) {
            modulesToLoad.push('leveling');
        }

        if (config.features.moderation) {
            modulesToLoad.push('moderation');
        }

        if (config.features.tickets) {
            modulesToLoad.push('ticket');
        }

        // Admin module (always loaded if available)
        modulesToLoad.push('admin');

        // Utility module (always loaded if available)
        modulesToLoad.push('utility');

        return modulesToLoad;
    }

    /**
     * Load a single module
     * @private
     * @param {string} moduleName - Module name
     */
    async loadModule(moduleName) {
        try {
            // Load module definition
            const module = require(`../../application/modules/${moduleName}`);

            // Add getService method to module
            module.getService = (serviceName) => {
                return this.bot.services.get(serviceName);
            };

            this.bot.modules.set(moduleName, module);

            logger.info(`Loading module: ${module.name}`);

            // Load services for this module
            if (module.services && module.services.length > 0) {
                for (const serviceName of module.services) {
                    if (!this.bot.services.has(serviceName)) {
                        const ServiceClass = require(`../../application/modules/${moduleName}/services/${serviceName}`);
                        const serviceInstance = new ServiceClass(this.bot.client);
                        await serviceInstance.initialize();
                        this.bot.services.set(serviceName, serviceInstance);

                        logger.info(`  - Loaded service: ${serviceName}`);
                    }
                }
            }

            // Load controllers for this module
            for (const controllerName of module.controllers) {
                if (!this.bot.controllers.has(controllerName)) {
                    const ControllerClass = require(`../../application/controllers/${controllerName}`);
                    const controllerInstance = new ControllerClass(this.bot.client);
                    this.bot.controllers.set(controllerName, controllerInstance);

                    logger.info(`  - Loaded controller: ${controllerName}`);
                }
            }

            logger.info(`Module loaded: ${module.name} (${module.commands.length} commands)`);
        } catch (error) {
            logger.error(`Failed to load module: ${moduleName}`, {
                error: error.message,
                stack: error.stack,
            });
            // Continue loading other modules even if one fails
        }
    }

    /**
     * Load global services that are not tied to specific modules
     * @private
     */
    async loadGlobalServices() {
        try {
            logger.info('Loading global services...');

            // Load GuildInitializationService
            const GuildInitializationService = require('../../application/services/GuildInitializationService');
            const guildInitService = new GuildInitializationService(this.bot.client);
            await guildInitService.initialize();

            // Register service globally on client for easy access
            this.bot.client.guildInitializationService = guildInitService;
            this.bot.services.set('GuildInitializationService', guildInitService);

            logger.info('Global services loaded successfully');
        } catch (error) {
            logger.error('Failed to load global services', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Validate command methods to detect naming conflicts
     * @private
     */
    validateCommandMethods() {
        try {
            logger.info('Validating command methods...');

            let totalCommands = 0;
            let conflictCount = 0;
            const conflicts = [];

            // Iterate through all modules
            for (const [moduleName, module] of this.bot.modules) {
                // Check each command in the module
                for (const command of module.commands) {
                    totalCommands++;

                    const controller = this.bot.controllers.get(command.controller);

                    if (!controller) {
                        logger.warn(`Command ${command.name} references missing controller: ${command.controller}`);
                        conflicts.push({
                            command: command.name,
                            controller: command.controller,
                            method: command.method,
                            issue: 'Controller not found',
                        });
                        conflictCount++;
                        continue;
                    }

                    const methodType = typeof controller[command.method];

                    if (methodType !== 'function') {
                        // Get available methods for debugging
                        const availableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(controller))
                            .filter(m => typeof controller[m] === 'function' && m !== 'constructor');

                        logger.warn(`Naming conflict detected for command: ${command.name}`, {
                            controller: command.controller,
                            method: command.method,
                            actualType: methodType,
                            availableMethods: availableMethods.join(', '),
                        });

                        conflicts.push({
                            command: command.name,
                            controller: command.controller,
                            method: command.method,
                            issue: `Method is ${methodType}, not function`,
                            availableMethods,
                        });
                        conflictCount++;
                    }
                }
            }

            // Log validation summary
            if (conflictCount === 0) {
                logger.info(`Command validation complete: ${totalCommands} commands validated, no conflicts found`);
            } else {
                logger.warn(`Command validation complete: ${totalCommands} commands validated, ${conflictCount} conflicts found`, {
                    conflicts,
                });
            }

            return {
                totalCommands,
                conflictCount,
                conflicts,
            };
        } catch (error) {
            logger.error('Failed to validate command methods', {
                error: error.message,
                stack: error.stack,
            });
            return {
                totalCommands: 0,
                conflictCount: 0,
                conflicts: [],
            };
        }
    }
}

module.exports = ModuleLoader;
