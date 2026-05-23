/**
 * Ban Confirm Button Interaction
 * 
 * Handles the confirmation action for ban commands.
 * Executes the ban after user confirms the action.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const { EmbedBuilder } = require('discord.js');

class BanConfirmButton extends BaseInteraction {
    /**
     * Create a new BanConfirmButton instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client, {
            customId: 'ban_confirm',
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

        // Check if user has ban permissions
        if (!this.hasPermissions(interaction, ['BanMembers'])) {
            await this.sendError(interaction, 'You need Ban Members permission to use this');
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
            await interaction.deferUpdate();

            const moderationService = this.getModerationService();
            if (!moderationService) {
                await this.sendError(interaction, 'Moderation service not available');
                return;
            }

            // Get pending ban data
            const state = this.getGuildState(interaction.guild.id);
            const banData = state.pendingBan[interaction.user.id];

            // Execute ban
            const result = await moderationService.banMember(
                interaction.guild,
                banData.target,
                interaction.user,
                banData.reason,
                banData.deleteMessages
            );

            // Clean up pending ban
            delete state.pendingBan[interaction.user.id];
            this.setGuildState(interaction.guild.id, state);

            if (!result.success) {
                await interaction.editReply({
                    content: `❌ ${result.error}`,
                    embeds: [],
                    components: []
                });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0xc0392b)
                .setTitle('🔨 User Banned')
                .setDescription(`${banData.target.tag} has been banned`)
                .addFields(
                    { name: 'Reason', value: banData.reason },
                    { name: 'Moderator', value: `${interaction.user}` }
                )
                .setTimestamp();

            await interaction.editReply({
                content: null,
                embeds: [embed],
                components: []
            });

            this.log(`User ${banData.target.id} banned by ${interaction.user.id}`, 'info');
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }

    /**
     * Get ModerationService instance
     * @returns {Object|null} ModerationService or null
     */
    getModerationService() {
        const moderationModule = this.client.modules?.get('moderation');
        return moderationModule?.getService('ModerationService') || null;
    }
}

module.exports = BanConfirmButton;
