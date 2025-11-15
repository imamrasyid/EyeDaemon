/**
 * Kick Cancel Button Interaction
 * 
 * Handles the cancellation action for kick commands.
 * Cancels the kick and removes the confirmation message.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');

class KickCancelButton extends BaseInteraction {
    /**
     * Create a new KickCancelButton instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client, {
            customId: 'kick_cancel',
            type: 'button',

        });
    }

    /**
     * Validate the interaction
     * @param {Object} interaction - Discord interaction object
     * @returns {Promise<boolean>} True if validation passes
     */
    async validate(interaction) {
        // Check if in guild
        if (!interaction.guild) {
            await this.sendError(interaction, 'This interaction can only be used in a server');
            return false;
        }

        // Check if confirmation data exists
        const state = this.getGuildState(interaction.guild.id);
        if (!state || !state.pendingKick || !state.pendingKick[interaction.user.id]) {
            await this.sendError(interaction, 'No pending kick confirmation found or it has expired');
            return false;
        }

        return true;
    }

    /**
     * Execute the interaction
     * @param {Object} interaction - Discord interaction object
     * @returns {Promise<void>}
     */
    async execute(interaction) {
        try {
            // Get pending kick data
            const state = this.getGuildState(interaction.guild.id);
            const kickData = state.pendingKick[interaction.user.id];

            // Clean up pending kick
            delete state.pendingKick[interaction.user.id];
            this.setGuildState(interaction.guild.id, state);

            await interaction.update({
                content: `❌ Kick cancelled for user ID: ${kickData.targetId}`,
                embeds: [],
                components: []
            });

            this.log(`Kick cancelled for user ${kickData.targetId} by ${interaction.user.id}`, 'info');
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }
}

module.exports = KickCancelButton;
