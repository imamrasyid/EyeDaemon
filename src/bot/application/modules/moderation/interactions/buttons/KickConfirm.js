/**
 * Kick Confirm Button Interaction
 * 
 * Handles confirmation of user kick with ResponseHelper.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const ResponseHelper = require('../../../../../system/helpers/ResponseHelper');

class KickConfirmButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'kick_confirm',
            type: 'button',
        });
    }

    async execute(interaction) {
        try {
            await interaction.deferUpdate();

            const state = this.getGuildState(interaction.guild.id);
            if (!state || !state.pendingKick || !state.pendingKick[interaction.user.id]) {
                const embed = ResponseHelper.error('Expired Action', 'Kick confirmation has expired or was not found.');
                await interaction.editReply({ embeds: [embed], components: [] });
                return;
            }

            const kickData = state.pendingKick[interaction.user.id];
            const moderationService = this.getModerationService();

            if (!moderationService) {
                const embed = ResponseHelper.error('Service Unavailable', 'ModerationService is not available.');
                await interaction.editReply({ embeds: [embed], components: [] });
                return;
            }

            const member = await interaction.guild.members.fetch(kickData.targetId).catch(() => null);
            if (!member) {
                delete state.pendingKick[interaction.user.id];
                this.setGuildState(interaction.guild.id, state);
                const embed = ResponseHelper.error('User Not Found', 'Target user is no longer in this server.');
                await interaction.editReply({ embeds: [embed], components: [] });
                return;
            }

            const result = await moderationService.kickMember(
                interaction.guild,
                member,
                interaction.user,
                kickData.reason
            );

            delete state.pendingKick[interaction.user.id];
            this.setGuildState(interaction.guild.id, state);

            if (!result.success) {
                const embed = ResponseHelper.error('Kick Failed', result.error || 'Failed to kick user.');
                await interaction.editReply({ embeds: [embed], components: [] });
                return;
            }

            const embed = ResponseHelper.moderationCard({
                action: 'KICK',
                target: member.user,
                moderator: interaction.user,
                reason: kickData.reason,
            });

            await interaction.editReply({ embeds: [embed], components: [] });
            this.log(`User ${kickData.targetId} kicked by ${interaction.user.id}`, 'info');
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }

    getModerationService() {
        const moderationModule = this.client.modules?.get('moderation');
        return moderationModule?.getService('ModerationService') || null;
    }
}

module.exports = KickConfirmButton;
