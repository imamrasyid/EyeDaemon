/**
 * Shop Buy Cancel Button Interaction
 * 
 * Handles the cancellation of a shop item purchase.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');

class ShopBuyCancelButton extends BaseInteraction {
    /**
     * Create a new ShopBuyCancelButton instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client, {
            customId: 'shop_buy_cancel',
            type: 'button',
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

        return true;
    }

    /**
     * Execute the interaction
     * @param {Object} interaction - Discord interaction object
     * @returns {Promise<void>}
     */
    async execute(interaction) {
        try {
            // Simply update the message to show cancellation
            await interaction.update({
                content: '❌ Purchase cancelled',
                embeds: [],
                components: []
            });

            this.log(`User ${interaction.user.id} cancelled shop purchase`, 'info');

        } catch (error) {
            await this.handleError(interaction, error);
        }
    }
}

module.exports = ShopBuyCancelButton;
