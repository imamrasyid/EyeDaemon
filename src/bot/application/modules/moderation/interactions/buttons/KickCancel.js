/**
 * Kick Cancel Button Interaction
 * 
 * Handles the cancellation action for kick commands with ResponseHelper.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const ResponseHelper = require('../../../../../system/helpers/ResponseHelper');

class KickCancelButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'kick_cancel',
            type: 'button',
        });
    }

    async validate(interaction) {
        if (!interaction.guild) {
            await this.sendError(interaction, 'This interaction can only be used in a server');
            return false;
        }

        const state = this.getGuildState(interaction.guild.id);
        if (!state || !state.pendingKick || !state.pendingKick[interaction.user.id]) {
            await this.sendError(interaction, 'No pending kick confirmation found or it has expired');
            return false;
        }

        return true;
    }

    async execute(interaction) {
        try {
            const state = this.getGuildState(interaction.guild.id);
            const kickData = state.pendingKick[interaction.user.id];

            delete state.pendingKick[interaction.user.id];
            this.setGuildState(interaction.guild.id, state);

            const embed = ResponseHelper.info(
                'Kick Action Cancelled',
                `Kick action for user ID \`${kickData.targetId}\` was aborted by ${interaction.user}.`
            );

            await interaction.update({
                embeds: [embed],
                components: []
            });

            this.log(`Kick cancelled for user ${kickData.targetId} by ${interaction.user.id}`, 'info');
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }
}

module.exports = KickCancelButton;
