/**
 * Warn Reason Modal Interaction
 * 
 * Handles submission of warn reason modal with ResponseHelper.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const ResponseHelper = require('../../../../../system/helpers/ResponseHelper');

class WarnReasonModal extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'warn_reason_modal',
            type: 'modal',
        });
    }

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const state = this.getGuildState(interaction.guild.id);
            if (!state || !state.pendingWarn || !state.pendingWarn[interaction.user.id]) {
                const embed = ResponseHelper.error('Expired Action', 'Warn session has expired or was not found.');
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const warnData = state.pendingWarn[interaction.user.id];
            const moderationService = this.getModerationService();

            if (!moderationService) {
                const embed = ResponseHelper.error('Service Unavailable', 'ModerationService is not available.');
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const reason = interaction.fields.getTextInputValue('warn_reason_input');

            const result = await moderationService.warnMember(
                interaction.guild,
                warnData.target,
                interaction.user,
                reason
            );

            delete state.pendingWarn[interaction.user.id];
            this.setGuildState(interaction.guild.id, state);

            if (!result.success) {
                const embed = ResponseHelper.error('Warn Failed', result.error || 'Failed to warn user.');
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const embed = ResponseHelper.moderationCard({
                action: 'WARN',
                target: warnData.target,
                moderator: interaction.user,
                reason,
                caseId: result.warning?.id,
            });

            await interaction.editReply({ embeds: [embed] });
            this.log(`User ${warnData.target.id} warned by ${interaction.user.id}`, 'info');
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }

    getModerationService() {
        const moderationModule = this.client.modules?.get('moderation');
        return moderationModule?.getService('ModerationService') || null;
    }
}

module.exports = WarnReasonModal;
