/**
 * Ban Confirm Button Interaction
 * 
 * Handles confirmation of user ban with ResponseHelper.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const ResponseHelper = require('../../../../../system/helpers/ResponseHelper');

class BanConfirmButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'ban_confirm',
            type: 'button',
        });
    }

    async execute(interaction) {
        try {
            await interaction.deferUpdate();

            const state = this.getGuildState(interaction.guild.id);
            if (!state || !state.pendingBan || !state.pendingBan[interaction.user.id]) {
                const embed = ResponseHelper.error('Expired Action', 'Ban confirmation has expired or was not found.');
                await interaction.editReply({ embeds: [embed], components: [] });
                return;
            }

            const banData = state.pendingBan[interaction.user.id];
            const moderationService = this.getModerationService();

            if (!moderationService) {
                const embed = ResponseHelper.error('Service Unavailable', 'ModerationService is not available.');
                await interaction.editReply({ embeds: [embed], components: [] });
                return;
            }

            const result = await moderationService.banMember(
                interaction.guild,
                banData.target,
                interaction.user,
                banData.reason,
                banData.deleteMessages
            );

            delete state.pendingBan[interaction.user.id];
            this.setGuildState(interaction.guild.id, state);

            if (!result.success) {
                const embed = ResponseHelper.error('Ban Failed', result.error || 'Failed to ban user.');
                await interaction.editReply({ embeds: [embed], components: [] });
                return;
            }

            const embed = ResponseHelper.moderationCard({
                action: 'BAN',
                target: banData.target,
                moderator: interaction.user,
                reason: banData.reason,
            });

            await interaction.editReply({ embeds: [embed], components: [] });
            this.log(`User ${banData.target.id} banned by ${interaction.user.id}`, 'info');
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }

    getModerationService() {
        const moderationModule = this.client.modules?.get('moderation');
        return moderationModule?.getService('ModerationService') || null;
    }
}

module.exports = BanConfirmButton;
