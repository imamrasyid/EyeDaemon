/**
 * Shop Buy Cancel Button Interaction
 * 
 * Handles the cancellation of a shop item purchase with ResponseHelper.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const ResponseHelper = require('../../../../../system/helpers/ResponseHelper');

class ShopBuyCancelButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'shop_buy_cancel',
            type: 'button',
            ephemeral: false
        });
    }

    async validate(interaction) {
        if (!interaction.guild) {
            await this.sendError(interaction, 'This interaction can only be used in a server');
            return false;
        }
        return true;
    }

    async execute(interaction) {
        try {
            const embed = ResponseHelper.info(
                'Purchase Cancelled',
                'Your shop item transaction has been cancelled. No coins were deducted from your wallet.'
            );

            await interaction.update({
                embeds: [embed],
                components: []
            });

            this.log(`User ${interaction.user.id} cancelled shop purchase`, 'info');
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }
}

module.exports = ShopBuyCancelButton;
