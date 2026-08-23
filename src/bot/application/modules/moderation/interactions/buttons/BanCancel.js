/**
 * Ban Cancel Button Interaction
 * 
 * Handles the cancellation action for ban commands with ResponseHelper.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const ResponseHelper = require('../../../../../system/helpers/ResponseHelper');

class BanCancelButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'ban_cancel',
            type: 'button',
        });
    }

    async validate(interaction) {
        if (!interaction.guild) {
            await this.sendError(interaction, 'This interaction can only be used in a server');
            return false;
        }

        const state = this.getGuildState(interaction.guild.id);
        if (!state || !state.pendingBan || !state.pendingBan[interaction.user.id]) {
            await this.sendError(interaction, 'No pending ban confirmation found or it has expired');
            return false;
        }

        return true;
    }

    async execute(interaction) {
        try {
            const state = this.getGuildState(interaction.guild.id);
            const banData = state.pendingBan[interaction.user.id];

            delete state.pendingBan[interaction.user.id];
            this.setGuildState(interaction.guild.id, state);

            const embed = ResponseHelper.info(
                'Ban Action Cancelled',
                `Ban sanction for **${banData.target.tag || banData.target.username}** was aborted by ${interaction.user}.`
            );

            await interaction.update({
                embeds: [embed],
                components: []
            });

            this.log(`Ban cancelled for user ${banData.target.id} by ${interaction.user.id}`, 'info');
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }
}

module.exports = BanCancelButton;
