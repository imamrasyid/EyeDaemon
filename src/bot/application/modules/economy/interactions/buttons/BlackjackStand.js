/**
 * Blackjack Stand Button Interaction
 * 
 * Handles ending turn and evaluating dealer round in blackjack with ResponseHelper.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const ResponseHelper = require('../../../../../system/helpers/ResponseHelper');

class BlackjackStandButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'blackjack_stand',
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
            const economyService = this.getEconomyService();

            const game = gameService.blackjackStand(interaction.user.id, interaction.guild.id);

            if (game.result === 'win') {
                await economyService.addBalance(
                    interaction.user.id,
                    interaction.guild.id,
                    game.winAmount,
                    'Blackjack win'
                );
            } else if (game.result === 'tie') {
                await economyService.addBalance(
                    interaction.user.id,
                    interaction.guild.id,
                    game.bet,
                    'Blackjack tie (refund)'
                );
            }

            const embed = ResponseHelper.blackjackCard(game);

            await interaction.update({
                embeds: [embed],
                components: []
            });

            this.log(`User ${interaction.user.id} completed blackjack game with result: ${game.result}`, 'info');
        } catch (error) {
            await this.handleError(interaction, error);
        }
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

module.exports = BlackjackStandButton;
