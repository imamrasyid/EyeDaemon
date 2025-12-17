/**
 * Interaction Components Manager
 * 
 * Manages buttons, select menus, and modals with state management
 */

const { Collection } = require('discord.js');
const logger = require('../helpers/logger_helper');
const { handleInteractionError } = require('../helpers/error_handler_helper');

class InteractionComponentsManager {
    /**
     * Create a new InteractionComponentsManager instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.buttons = new Collection();
        this.select_menus = new Collection();
        this.modals = new Collection();
        this.component_states = new Collection();
    }

    /**
     * Register a button handler
     * @param {string} custom_id - Button custom ID (supports wildcards)
     * @param {Function} handler - Button handler function
     * @param {Object} options - Button options
     * @returns {void}
     */
    register_button(custom_id, handler, options = {}) {
        this.buttons.set(custom_id, {
            handler,
            cooldown: options.cooldown || 0,
            permissions: options.permissions || [],
            ephemeral: options.ephemeral || false,
            stateful: options.stateful || false,
        });

        logger.debug(`Registered button handler: ${custom_id}`);
    }

    /**
     * Register a select menu handler
     * @param {string} custom_id - Select menu custom ID
     * @param {Function} handler - Select menu handler function
     * @param {Object} options - Select menu options
     * @returns {void}
     */
    register_select_menu(custom_id, handler, options = {}) {
        this.select_menus.set(custom_id, {
            handler,
            cooldown: options.cooldown || 0,
            permissions: options.permissions || [],
            ephemeral: options.ephemeral || false,
        });

        logger.debug(`Registered select menu handler: ${custom_id}`);
    }

    /**
     * Register a modal handler
     * @param {string} custom_id - Modal custom ID
     * @param {Function} handler - Modal handler function
     * @param {Object} options - Modal options
     * @returns {void}
     */
    register_modal(custom_id, handler, options = {}) {
        this.modals.set(custom_id, {
            handler,
            cooldown: options.cooldown || 0,
            permissions: options.permissions || [],
        });

        logger.debug(`Registered modal handler: ${custom_id}`);
    }

    /**
     * Handle button interaction
     * @param {ButtonInteraction} interaction - Button interaction
     * @returns {Promise<void>}
     */
    async handle_button(interaction) {
        const custom_id = interaction.customId;
        const button = this._find_button_handler(custom_id);

        if (!button) {
            await interaction.reply({
                content: '❌ This button is no longer valid.',
                ephemeral: true,
            });
            return;
        }

        // Check permissions
        if (!(await this._check_permissions(interaction, button))) {
            return;
        }

        // Check cooldown
        if (!(await this._check_cooldown(interaction, button, custom_id))) {
            return;
        }

        // Execute handler
        try {
            await button.handler(interaction);
        } catch (error) {
            await handleInteractionError(error, interaction, {
                componentType: 'button',
                customId: custom_id,
            });
        }
    }

    /**
     * Handle select menu interaction
     * @param {SelectMenuInteraction} interaction - Select menu interaction
     * @returns {Promise<void>}
     */
    async handle_select_menu(interaction) {
        const custom_id = interaction.customId;
        const select_menu = this.select_menus.get(custom_id);

        if (!select_menu) {
            await interaction.reply({
                content: '❌ This select menu is no longer valid.',
                ephemeral: true,
            });
            return;
        }

        // Check permissions
        if (!(await this._check_permissions(interaction, select_menu))) {
            return;
        }

        // Check cooldown
        if (!(await this._check_cooldown(interaction, select_menu, custom_id))) {
            return;
        }

        // Execute handler
        try {
            await select_menu.handler(interaction);
        } catch (error) {
            await handleInteractionError(error, interaction, {
                componentType: 'select_menu',
                customId: custom_id,
            });
        }
    }

    /**
     * Handle modal interaction
     * @param {ModalSubmitInteraction} interaction - Modal interaction
     * @returns {Promise<void>}
     */
    async handle_modal(interaction) {
        const custom_id = interaction.customId;
        const modal = this.modals.get(custom_id);

        if (!modal) {
            await interaction.reply({
                content: '❌ This modal is no longer valid.',
                ephemeral: true,
            });
            return;
        }

        // Check permissions
        if (!(await this._check_permissions(interaction, modal))) {
            return;
        }

        // Check cooldown
        if (!(await this._check_cooldown(interaction, modal, custom_id))) {
            return;
        }

        // Execute handler
        try {
            await modal.handler(interaction);
        } catch (error) {
            await handleInteractionError(error, interaction, {
                componentType: 'modal',
                customId: custom_id,
            });
        }
    }

    /**
     * Find button handler (supports wildcards)
     * @param {string} custom_id - Button custom ID
     * @returns {Object|null} Button handler or null
     * @private
     */
    _find_button_handler(custom_id) {
        // Exact match
        if (this.buttons.has(custom_id)) {
            return this.buttons.get(custom_id);
        }

        // Wildcard match (e.g., "pagination:*")
        for (const [pattern, handler] of this.buttons.entries()) {
            if (pattern.includes('*')) {
                const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                if (regex.test(custom_id)) {
                    return handler;
                }
            }
        }

        return null;
    }

    /**
     * Check if user has required permissions
     * @param {Interaction} interaction - Discord interaction
     * @param {Object} component - Component definition
     * @returns {Promise<boolean>}
     * @private
     */
    async _check_permissions(interaction, component) {
        if (!component.permissions || component.permissions.length === 0) {
            return true;
        }

        if (!interaction.member) {
            return true; // DMs don't have member
        }

        const member_permissions = interaction.member.permissions;
        const has_permissions = component.permissions.every((perm) =>
            member_permissions.has(perm)
        );

        if (!has_permissions) {
            await interaction.reply({
                content: `❌ You don't have permission to use this component.`,
                ephemeral: true,
            });
            return false;
        }

        return true;
    }

    /**
     * Check component cooldown
     * @param {Interaction} interaction - Discord interaction
     * @param {Object} component - Component definition
     * @param {string} custom_id - Component custom ID
     * @returns {Promise<boolean>}
     * @private
     */
    async _check_cooldown(interaction, component, custom_id) {
        if (!component.cooldown || component.cooldown === 0) {
            return true;
        }

        const cooldown_key = `${custom_id}-${interaction.user.id}`;
        const cooldown = this.component_states.get(cooldown_key);

        if (cooldown && cooldown > Date.now()) {
            const remaining = Math.ceil((cooldown - Date.now()) / 1000);
            await interaction.reply({
                content: `⏳ Please wait ${remaining} second(s) before using this again.`,
                ephemeral: true,
            });
            return false;
        }

        this.component_states.set(
            cooldown_key,
            Date.now() + component.cooldown * 1000
        );

        // Clean up old cooldowns
        setTimeout(() => {
            this.component_states.delete(cooldown_key);
        }, component.cooldown * 1000);

        return true;
    }

    /**
     * Set component state (for stateful components)
     * @param {string} key - State key
     * @param {*} value - State value
     * @param {number} ttl - Time to live in milliseconds
     * @returns {void}
     */
    set_state(key, value, ttl = 300000) {
        this.component_states.set(key, {
            value,
            expires: Date.now() + ttl,
        });

        // Auto cleanup
        setTimeout(() => {
            this.component_states.delete(key);
        }, ttl);
    }

    /**
     * Get component state
     * @param {string} key - State key
     * @returns {*} State value or null
     */
    get_state(key) {
        const state = this.component_states.get(key);
        if (!state) {
            return null;
        }

        if (state.expires && state.expires < Date.now()) {
            this.component_states.delete(key);
            return null;
        }

        return state.value;
    }

    /**
     * Clear component state
     * @param {string} key - State key
     * @returns {void}
     */
    clear_state(key) {
        this.component_states.delete(key);
    }

    /**
     * Cleanup expired states
     * @returns {void}
     */
    cleanup_states() {
        const now = Date.now();
        for (const [key, state] of this.component_states.entries()) {
            if (state.expires && state.expires < now) {
                this.component_states.delete(key);
            }
        }
    }
}

module.exports = InteractionComponentsManager;
