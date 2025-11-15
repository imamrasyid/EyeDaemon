/**
 * InteractionManager
 * 
 * Manages Discord interaction handlers (buttons, modals, select menus).
 * Automatically loads interaction handlers from module directories.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../helpers/logger_helper');

class InteractionManager {
    /**
     * Create a new InteractionManager instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.interactions = new Map();
    }

    /**
     * Load all interaction handlers from modules
     * @returns {Promise<void>}
     */
    async loadInteractions() {
        try {
            logger.info('Loading interaction handlers...');

            const modulesPath = path.join(__dirname, '../../application/modules');
            const modules = fs.readdirSync(modulesPath);

            for (const moduleName of modules) {
                const modulePath = path.join(modulesPath, moduleName);
                const interactionsPath = path.join(modulePath, 'interactions');

                // Check if interactions directory exists
                if (!fs.existsSync(interactionsPath)) {
                    continue;
                }

                // Load interactions from subdirectories (buttons, modals, select-menus)
                await this.loadInteractionsFromDirectory(interactionsPath, moduleName);
            }

            logger.info(`Loaded ${this.interactions.size} interaction handlers`);
        } catch (error) {
            logger.error('Failed to load interaction handlers', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Load interactions from a directory
     * @param {string} directory - Directory path
     * @param {string} moduleName - Module name
     * @returns {Promise<void>}
     */
    async loadInteractionsFromDirectory(directory, moduleName) {
        try {
            const items = fs.readdirSync(directory);

            for (const item of items) {
                const itemPath = path.join(directory, item);
                const stat = fs.statSync(itemPath);

                if (stat.isDirectory()) {
                    // Recursively load from subdirectories
                    await this.loadInteractionsFromDirectory(itemPath, moduleName);
                } else if (item.endsWith('.js')) {
                    // Skip helper files (files ending with Helper.js or in helpers directory)
                    if (item.endsWith('Helper.js') || directory.includes('helpers')) {
                        continue;
                    }

                    // Load interaction handler
                    try {
                        const InteractionClass = require(itemPath);
                        const interaction = new InteractionClass(this.client);

                        // Register interaction
                        this.registerInteraction(interaction);

                        logger.info(`  - Loaded interaction: ${interaction.customId} (${moduleName})`);
                    } catch (error) {
                        logger.error(`Failed to load interaction: ${item}`, {
                            module: moduleName,
                            error: error.message,
                        });
                    }
                }
            }
        } catch (error) {
            logger.error('Failed to load interactions from directory', {
                directory,
                error: error.message,
            });
        }
    }

    /**
     * Register an interaction handler
     * @param {Object} interaction - Interaction handler instance
     */
    registerInteraction(interaction) {
        if (!interaction.customId) {
            throw new Error('Interaction must have a customId');
        }

        if (this.interactions.has(interaction.customId)) {
            logger.warn(`Interaction ${interaction.customId} is already registered, overwriting`);
        }

        this.interactions.set(interaction.customId, interaction);
    }

    /**
     * Unregister an interaction handler
     * @param {string} customId - Custom ID of the interaction
     */
    unregisterInteraction(customId) {
        this.interactions.delete(customId);
    }

    /**
     * Get an interaction handler by custom ID
     * @param {string} customId - Custom ID of the interaction
     * @returns {Object|null} Interaction handler or null
     */
    getInteraction(customId) {
        return this.interactions.get(customId) || null;
    }

    /**
     * Handle an interaction
     * @param {Object} interaction - Discord interaction object
     * @returns {Promise<void>}
     */
    async handleInteraction(interaction) {
        try {
            const handler = this.getInteraction(interaction.customId);

            if (!handler) {
                logger.warn(`No handler found for interaction: ${interaction.customId}`);
                return;
            }

            // Validate interaction
            const isValid = await handler.validate(interaction);
            if (!isValid) {
                return;
            }

            // Execute interaction handler
            await handler.execute(interaction);
        } catch (error) {
            logger.error('Error handling interaction', {
                customId: interaction.customId,
                type: interaction.type,
                error: error.message,
                stack: error.stack,
            });

            // Send error response
            const errorMessage = '❌ An error occurred while processing your interaction';

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({ content: errorMessage });
                } else {
                    await interaction.reply({ content: errorMessage });
                }
            } catch (replyError) {
                logger.error('Failed to send error message', {
                    error: replyError.message,
                });
            }
        }
    }

    /**
     * Cleanup all interaction handlers
     */
    cleanup() {
        this.interactions.clear();
        logger.info('Interaction handlers cleaned up');
    }
}

module.exports = InteractionManager;
