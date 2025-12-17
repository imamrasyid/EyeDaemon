/**
 * Pagination Manager
 * 
 * Manages pagination for embeds and messages
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../helpers/logger_helper');

class PaginationManager {
    /**
     * Create a new PaginationManager instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.active_paginations = new Map();
    }

    /**
     * Create paginated message
     * @param {Interaction} interaction - Discord interaction
     * @param {Array} pages - Array of embed data or embeds
     * @param {Object} options - Pagination options
     * @returns {Promise<Message>} Sent message
     */
    async create_pagination(interaction, pages, options = {}) {
        if (!pages || pages.length === 0) {
            throw new Error('Pages array cannot be empty');
        }

        const pagination_id = `${interaction.user.id}-${Date.now()}`;
        const current_page = options.initial_page || 0;
        const timeout = options.timeout || 300000; // 5 minutes
        const ephemeral = options.ephemeral || false;

        // Store pagination state
        this.active_paginations.set(pagination_id, {
            pages,
            current_page: Math.max(0, Math.min(current_page, pages.length - 1)),
            user_id: interaction.user.id,
            message_id: null,
            timeout,
            ephemeral,
            custom_buttons: options.custom_buttons || null,
        });

        // Create initial message
        const message = await this._send_pagination_message(
            interaction,
            pagination_id,
            ephemeral
        );

        // Store message ID
        const pagination = this.active_paginations.get(pagination_id);
        pagination.message_id = message.id;

        // Set timeout
        if (timeout > 0) {
            setTimeout(() => {
                this._cleanup_pagination(pagination_id);
            }, timeout);
        }

        return message;
    }

    /**
     * Send pagination message
     * @param {Interaction} interaction - Discord interaction
     * @param {string} pagination_id - Pagination ID
     * @param {boolean} ephemeral - Whether message is ephemeral
     * @returns {Promise<Message>} Sent message
     * @private
     */
    async _send_pagination_message(interaction, pagination_id, ephemeral) {
        const pagination = this.active_paginations.get(pagination_id);
        if (!pagination) {
            throw new Error('Pagination not found');
        }

        const { pages, current_page } = pagination;
        const page_data = pages[current_page];

        // Create embed if page_data is not already an embed
        let embed;
        if (page_data instanceof require('discord.js').EmbedBuilder) {
            embed = page_data;
        } else {
            const EmbedBuilder = require('../libraries/embed_builder');
            const embed_builder = new EmbedBuilder(this.client);
            embed = embed_builder.create(page_data);
        }

        // Add page info to footer if not present
        if (!embed.data.footer) {
            embed.setFooter({
                text: `Page ${current_page + 1} of ${pages.length}`,
            });
        }

        // Create buttons
        const buttons = this._create_pagination_buttons(pagination);

        // Send or reply
        if (interaction.replied || interaction.deferred) {
            return await interaction.editReply({
                embeds: [embed],
                components: buttons.length > 0 ? [buttons] : [],
            });
        } else {
            return await interaction.reply({
                embeds: [embed],
                components: buttons.length > 0 ? [buttons] : [],
                ephemeral,
            });
        }
    }

    /**
     * Create pagination buttons
     * @param {Object} pagination - Pagination state
     * @returns {ActionRowBuilder} Action row with buttons
     * @private
     */
    _create_pagination_buttons(pagination) {
        const { pages, current_page, custom_buttons } = pagination;

        if (custom_buttons) {
            return custom_buttons;
        }

        const row = new ActionRowBuilder();

        // First page button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`pagination:first:${pagination.message_id}`)
                .setLabel('⏮️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(current_page === 0)
        );

        // Previous page button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`pagination:prev:${pagination.message_id}`)
                .setLabel('◀️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(current_page === 0)
        );

        // Page indicator (non-interactive)
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`pagination:page:${pagination.message_id}`)
                .setLabel(`${current_page + 1}/${pages.length}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        // Next page button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`pagination:next:${pagination.message_id}`)
                .setLabel('▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(current_page === pages.length - 1)
        );

        // Last page button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`pagination:last:${pagination.message_id}`)
                .setLabel('⏭️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(current_page === pages.length - 1)
        );

        return row;
    }

    /**
     * Handle pagination button interaction
     * @param {ButtonInteraction} interaction - Button interaction
     * @returns {Promise<void>}
     */
    async handle_pagination_button(interaction) {
        const custom_id = interaction.customId;
        const parts = custom_id.split(':');

        if (parts.length < 3 || parts[0] !== 'pagination') {
            return;
        }

        const action = parts[1];
        const message_id = parts[2];

        // Find pagination by message ID
        let pagination = null;
        let pagination_id = null;

        for (const [id, pag] of this.active_paginations.entries()) {
            if (pag.message_id === message_id) {
                pagination = pag;
                pagination_id = id;
                break;
            }
        }

        if (!pagination) {
            await interaction.reply({
                content: '❌ This pagination is no longer active.',
                ephemeral: true,
            });
            return;
        }

        // Check if user is the owner
        if (pagination.user_id !== interaction.user.id) {
            await interaction.reply({
                content: "❌ You can't control this pagination.",
                ephemeral: true,
            });
            return;
        }

        // Update page based on action
        let new_page = pagination.current_page;

        switch (action) {
            case 'first':
                new_page = 0;
                break;
            case 'prev':
                new_page = Math.max(0, pagination.current_page - 1);
                break;
            case 'next':
                new_page = Math.min(
                    pagination.pages.length - 1,
                    pagination.current_page + 1
                );
                break;
            case 'last':
                new_page = pagination.pages.length - 1;
                break;
        }

        // Update pagination state
        pagination.current_page = new_page;

        // Update message
        try {
            await this._send_pagination_message(interaction, pagination_id, false);
            await interaction.deferUpdate();
        } catch (error) {
            logger.error('Failed to update pagination', {
                error: error.message,
                pagination_id,
            });
            await interaction.reply({
                content: '❌ Failed to update pagination.',
                ephemeral: true,
            });
        }
    }

    /**
     * Cleanup pagination
     * @param {string} pagination_id - Pagination ID
     * @private
     */
    _cleanup_pagination(pagination_id) {
        const pagination = this.active_paginations.get(pagination_id);
        if (!pagination) {
            return;
        }

        // Remove buttons from message
        if (pagination.message_id) {
            // Try to edit message to remove buttons
            // This is best-effort, don't throw if it fails
            this.client.channels
                .fetch(pagination.message_id)
                .then((channel) => {
                    return channel.messages.fetch(pagination.message_id);
                })
                .then((message) => {
                    return message.edit({
                        components: [],
                    });
                })
                .catch(() => {
                    // Ignore errors during cleanup
                });
        }

        this.active_paginations.delete(pagination_id);
        logger.debug(`Cleaned up pagination: ${pagination_id}`);
    }

    /**
     * Get active pagination count
     * @returns {number} Active pagination count
     */
    get_active_count() {
        return this.active_paginations.size;
    }

    /**
     * Cleanup all paginations
     * @returns {void}
     */
    cleanup_all() {
        for (const pagination_id of this.active_paginations.keys()) {
            this._cleanup_pagination(pagination_id);
        }
    }
}

module.exports = PaginationManager;
