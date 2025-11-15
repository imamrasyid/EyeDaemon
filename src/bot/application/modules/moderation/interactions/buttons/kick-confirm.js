/**
 * Kick Confirm Button Interaction
 * 
 * Handles the confirmation action for kick commands.
 * Executes the kick after user confirms the action.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const { EmbedBuilder } = require('discord.js');

class KickConfirmButton extends BaseInteraction {
    /**
     * Create a new KickConfirmButton instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client, {
            customId: 'kick_confirm',
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

        // Check if user has kick permissions
        if (!this.hasPermissions(interaction, ['KickMembers'])) {
            await this.sendError(interaction, 'You need Kick Members permission to use this');
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
            await interaction.deferUpdate();

            const moderationService = this.getModerationService();
            if (!moderationService) {
                await this.sendError(interaction, 'Moderation service not available');
                return;
            }

            // Get pending kick data
            const state = this.getGuildState(interaction.guild.id);
            const kickData = state.pendingKick[interaction.user.id];

            // Fetch member
            const member = await interaction.guild.members.fetch(kickData.targetId).catch(() => null);
            if (!member) {
                await interaction.editReply({
                    content: '❌ User not found in this server',
                    embeds: [],
                    components: []
                });
                delete state.pendingKick[interaction.user.id];
                this.setGuildState(interaction.guild.id, state);
                return;
            }

            // Execute kick
            const result = await moderationService.kickMember(
                interaction.guild,
                member,
                interaction.user,
                kickData.reason
            );

            // Clean up pending kick
            delete state.pendingKick[interaction.user.id];
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
                .setColor(0xe74c3c)
                .setTitle('👢 User Kicked')
                .setDescription(`${member.user.tag} has been kicked`)
                .addFields(
                    { name: 'Reason', value: kickData.reason },
                    { name: 'Moderator', value: `${interaction.user}` }
                )
                .setTimestamp();

            await interaction.editReply({
                content: null,
                embeds: [embed],
                components: []
            });

            this.log(`User ${kickData.targetId} kicked by ${interaction.user.id}`, 'info');
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

module.exports = KickConfirmButton;
