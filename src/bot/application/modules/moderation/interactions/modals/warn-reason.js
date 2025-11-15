/**
 * Warn Reason Modal Interaction
 * 
 * Handles the modal submission for collecting warn reasons.
 * Allows moderators to provide detailed reasons via a modal form.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const { EmbedBuilder } = require('discord.js');

class WarnReasonModal extends BaseInteraction {
    /**
     * Create a new WarnReasonModal instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client, {
            customId: 'warn_reason_modal',
            type: 'modal',
            ephemeral: false
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

        // Check if user has moderate members permission
        if (!this.hasPermissions(interaction, ['ModerateMembers'])) {
            await this.sendError(interaction, 'You need Moderate Members permission to use this');
            return false;
        }

        // Check if pending warn data exists
        const state = this.getGuildState(interaction.guild.id);
        if (!state || !state.pendingWarn || !state.pendingWarn[interaction.user.id]) {
            await this.sendError(interaction, 'No pending warn found or it has expired');
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
            await interaction.deferReply({ ephemeral: false });

            const moderationService = this.getModerationService();
            if (!moderationService) {
                await this.sendError(interaction, 'Moderation service not available');
                return;
            }

            // Get pending warn data
            const state = this.getGuildState(interaction.guild.id);
            const warnData = state.pendingWarn[interaction.user.id];

            // Get reason from modal
            const reason = interaction.fields.getTextInputValue('warn_reason_input');

            // Execute warn
            const result = await moderationService.warnMember(
                interaction.guild,
                warnData.target,
                interaction.user,
                reason
            );

            // Clean up pending warn
            delete state.pendingWarn[interaction.user.id];
            this.setGuildState(interaction.guild.id, state);

            if (!result.success) {
                await interaction.editReply({
                    content: `❌ ${result.error}`
                });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0xe67e22)
                .setTitle('⚠️ User Warned')
                .setDescription(`${warnData.target} has been warned`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Moderator', value: `${interaction.user}` },
                    { name: 'Warning ID', value: result.warning.id.toString() }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            this.log(`User ${warnData.target.id} warned by ${interaction.user.id}`, 'info');
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

module.exports = WarnReasonModal;
