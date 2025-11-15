/**
 * Shop Buy Confirm Button Interaction
 * 
 * Handles the confirmation of a shop item purchase.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const { EmbedBuilder } = require('discord.js');

class ShopBuyConfirmButton extends BaseInteraction {
    /**
     * Create a new ShopBuyConfirmButton instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client, {
            customId: 'shop_buy_confirm',
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

        // Check if shop service is available
        const shopService = this.getShopService();
        if (!shopService) {
            await this.sendError(interaction, 'Shop service not available');
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
            // Extract item ID and quantity from message embed or custom data
            // For this implementation, we'll parse it from the embed footer
            const embed = interaction.message.embeds[0];
            if (!embed || !embed.footer || !embed.footer.text) {
                await this.sendError(interaction, 'Invalid purchase request');
                return;
            }

            // Parse footer text: "Item ID: <id> | Quantity: <qty>"
            const footerMatch = embed.footer.text.match(/Item ID: (.+?) \| Quantity: (\d+)/);
            if (!footerMatch) {
                await this.sendError(interaction, 'Invalid purchase data');
                return;
            }

            const itemId = footerMatch[1];
            const quantity = parseInt(footerMatch[2]);

            const shopService = this.getShopService();

            // Process purchase
            const result = await shopService.purchaseItem(
                interaction.user.id,
                interaction.guild.id,
                itemId,
                quantity
            );

            if (!result.success) {
                await interaction.update({
                    content: `❌ Purchase failed: ${result.message}`,
                    embeds: [],
                    components: []
                });
                return;
            }

            // Create success embed
            const successEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ Purchase Successful!')
                .setDescription(`You purchased **${quantity}x ${result.item.name}**`)
                .addFields(
                    { name: 'Total Cost', value: `${result.totalPrice} coins`, inline: true },
                    { name: 'New Balance', value: `${result.newBalance} coins`, inline: true }
                )
                .setTimestamp();

            // If item has a role, mention it
            if (result.item.role_id) {
                const role = interaction.guild.roles.cache.get(result.item.role_id);
                if (role) {
                    successEmbed.addFields({
                        name: 'Role Assigned',
                        value: `You received the ${role} role!`,
                        inline: false
                    });

                    // Assign role to user
                    try {
                        const member = await interaction.guild.members.fetch(interaction.user.id);
                        await member.roles.add(role);
                    } catch (roleError) {
                        this.log(`Failed to assign role: ${roleError.message}`, 'error');
                        successEmbed.addFields({
                            name: 'Note',
                            value: 'Failed to automatically assign role. Please contact an administrator.',
                            inline: false
                        });
                    }
                }
            }

            await interaction.update({
                content: null,
                embeds: [successEmbed],
                components: []
            });

            this.log(`User ${interaction.user.id} purchased ${quantity}x ${result.item.name}`, 'info');

        } catch (error) {
            await this.handleError(interaction, error);
        }
    }

    /**
     * Get ShopService instance
     * @returns {Object|null} ShopService or null
     */
    getShopService() {
        const economyModule = this.client.modules?.get('economy');
        return economyModule?.getService('ShopService') || null;
    }
}

module.exports = ShopBuyConfirmButton;
