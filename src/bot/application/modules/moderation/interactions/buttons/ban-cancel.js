/**
 * Ban Cancel Button Interaction
 * 
 * Handles the cancellation action for ban commands.
 * Cancels the ban and removes the confirmation message.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');

class BanCancelButton extends BaseInteraction {
    /**
     * Create a new BanCancelButton instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client, {
            customId: 'ban_cancel',
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
        if (!state || !state.pendingBan || !state.pendingBan[interaction.user.id]) {
            await this.sendError(interaction, 'No pending ban confirmation found or it has expired');
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
            // Get pending ban data
            const state = this.getGuildState(interaction.guild.id);
            const banData = state.pendingBan[interaction.user.id];

            // Clean up pending ban
            delete state.pendingBan[interaction.user.id];
            this.setGuildState(interaction.guild.id, state);

            await interaction.update({
                content: `❌ Ban cancelled for ${banData.target.tag}`,
                embeds: [],
                components: []
            });

            this.log(`Ban cancelled for user ${banData.target.id} by ${interaction.user.id}`, 'info');
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }
}

module.exports = BanCancelButton;
