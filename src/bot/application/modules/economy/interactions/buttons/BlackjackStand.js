/**
 * Blackjack Stand Button Interaction
 * 
 * Handles the "stand" action in blackjack games where the player ends their turn
 * and the dealer plays out their hand.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class BlackjackStandButton extends BaseInteraction {
    /**
     * Create a new BlackjackStandButton instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client, {
            customId: 'blackjack_stand',
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

        // Check if user is the one who started the game
        const gameService = this.getGameService();
        if (!gameService) {
            await this.sendError(interaction, 'Game service not available');
            return false;
        }

        const game = gameService.getBlackjackGame(interaction.user.id, interaction.guild.id);
        if (!game) {
            await this.sendError(interaction, 'No active blackjack game found');
            return false;
        }

        if (game.status !== 'active') {
            await this.sendError(interaction, 'This game is no longer active');
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
            const gameService = this.getGameService();
            const economyService = this.getEconomyService();

            // Stand (end turn, dealer plays)
            const game = gameService.blackjackStand(interaction.user.id, interaction.guild.id);

            // Update balance based on result
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

            // Create result embed
            let embedColor = 0x95a5a6; // Gray for tie
            let embedTitle = 'Blackjack - Game Over';

            if (game.result === 'win') {
                embedColor = 0x2ecc71; // Green for win
                embedTitle = 'Blackjack - You Win!';
            } else if (game.result === 'lose') {
                embedColor = 0xe74c3c; // Red for loss
                embedTitle = 'Blackjack - You Lost!';
            } else if (game.result === 'tie') {
                embedTitle = 'Blackjack - It\'s a Tie!';
            }

            const embed = this.createGameEmbed(game, embedTitle, embedColor);

            await interaction.update({
                embeds: [embed],
                components: [] // Remove buttons
            });

            this.log(`User ${interaction.user.id} completed blackjack game with result: ${game.result}`, 'info');

        } catch (error) {
            await this.handleError(interaction, error);
        }
    }

    /**
     * Create game embed
     * @param {Object} game - Game state
     * @param {string} title - Embed title
     * @param {number} color - Embed color
     * @returns {EmbedBuilder} Game embed
     */
    createGameEmbed(game, title, color) {
        const gameService = this.getGameService();

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`🃏 ${title}`)
            .addFields(
                {
                    name: 'Your Hand',
                    value: `${gameService.formatHand(game.playerHand)}\n**Value: ${game.playerValue}**`,
                    inline: true
                },
                {
                    name: 'Dealer Hand',
                    value: `${gameService.formatHand(game.dealerHand)}\n**Value: ${game.dealerValue}**`,
                    inline: true
                },
                {
                    name: 'Bet',
                    value: `${game.bet} coins`,
                    inline: true
                }
            )
            .setTimestamp();

        // Add result field
        let resultText = '';
        if (game.result === 'win') {
            resultText = `🎉 You won **${game.winAmount} coins**!`;
        } else if (game.result === 'lose') {
            resultText = `💔 You lost **${game.bet} coins**`;
        } else if (game.result === 'tie') {
            resultText = `🤝 It's a tie! You get your **${game.bet} coins** back`;
        }

        embed.addFields({
            name: 'Result',
            value: resultText,
            inline: false
        });

        return embed;
    }

    /**
     * Get GameService instance
     * @returns {Object|null} GameService or null
     */
    getGameService() {
        const economyModule = this.client.modules?.get('economy');
        return economyModule?.getService('GameService') || null;
    }

    /**
     * Get EconomyService instance
     * @returns {Object|null} EconomyService or null
     */
    getEconomyService() {
        const economyModule = this.client.modules?.get('economy');
        return economyModule?.getService('EconomyService') || null;
    }
}

module.exports = BlackjackStandButton;
