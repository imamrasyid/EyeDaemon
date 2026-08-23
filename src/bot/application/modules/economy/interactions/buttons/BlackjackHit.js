/**
 * Blackjack Hit Button Interaction
 * 
 * Handles drawing an additional card in blackjack with ResponseHelper.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ResponseHelper = require('../../../../../system/helpers/ResponseHelper');

class BlackjackHitButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'blackjack_hit',
            type: 'button',
        });
    }

    async validate(interaction) {
        const gameService = this.getGameService();
        if (!gameService) {
            await this.sendError(interaction, 'Game service not available');
            return false;
        }

        const game = gameService.getBlackjackGame(interaction.user.id, interaction.guild.id);
        if (!game) {
            const embed = ResponseHelper.warning('Game Expired', 'No active blackjack game found. Start a new game with `/blackjack`.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return false;
        }

        if (game.status !== 'active') {
            const embed = ResponseHelper.warning('Game Completed', 'This blackjack game has already concluded.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return false;
        }

        return true;
    }

    async execute(interaction) {
        try {
            const gameService = this.getGameService();
            const game = gameService.blackjackHit(interaction.user.id, interaction.guild.id);

            const embed = ResponseHelper.blackjackCard(game);

            if (game.status === 'bust') {
                await interaction.update({
                    embeds: [embed],
                    components: []
                });
                this.log(`User ${interaction.user.id} busted in blackjack`, 'info');
                return;
            }

            const buttons = this.createGameButtons();
            await interaction.update({
                embeds: [embed],
                components: [buttons]
            });
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }

    createGameButtons() {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('blackjack_hit')
                .setLabel('Hit (Draw Card)')
                .setEmoji('🃏')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('blackjack_stand')
                .setLabel('Stand (End Turn)')
                .setEmoji('🛑')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    getGameService() {
        const economyModule = this.client.modules?.get('economy');
        return economyModule?.getService('GameService') || null;
    }

    getEconomyService() {
        const economyModule = this.client.modules?.get('economy');
        return economyModule?.getService('EconomyService') || null;
    }
}

module.exports = BlackjackHitButton;
