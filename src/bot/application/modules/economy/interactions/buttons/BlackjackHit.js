/**
 * Blackjack Hit Button Interaction
 * 
 * Handles the "hit" action in blackjack games where the player draws another card.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class BlackjackHitButton extends BaseInteraction {
    /**
     * Create a new BlackjackHitButton instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client, {
            customId: 'blackjack_hit',
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

            // Hit (draw a card)
            const game = gameService.blackjackHit(interaction.user.id, interaction.guild.id);

            // Check if player busted
            if (game.status === 'bust') {
                // Player lost
                const embed = this.createGameEmbed(game, 'Bust! You Lost!', 0xe74c3c);

                await interaction.update({
                    embeds: [embed],
                    components: [] // Remove buttons
                });

                this.log(`User ${interaction.user.id} busted in blackjack`, 'info');
                return;
            }

            // Game still active, show updated state
            const embed = this.createGameEmbed(game, 'Blackjack', 0x3498db);
            const buttons = this.createGameButtons();

            await interaction.update({
                embeds: [embed],
                components: [buttons]
            });

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
                    value: game.status === 'active'
                        ? `${gameService.formatCard(game.dealerHand[0])} 🂠\n**Value: ?**`
                        : `${gameService.formatHand(game.dealerHand)}\n**Value: ${game.dealerValue}**`,
                    inline: true
                },
                {
                    name: 'Bet',
                    value: `${game.bet} coins`,
                    inline: true
                }
            )
            .setTimestamp();

        // Add result field if game is over
        if (game.status !== 'active') {
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
        }

        return embed;
    }

    /**
     * Create game control buttons
     * @returns {ActionRowBuilder} Button row
     */
    createGameButtons() {
        const hitButton = new ButtonBuilder()
            .setCustomId('blackjack_hit')
            .setLabel('Hit')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎴');

        const standButton = new ButtonBuilder()
            .setCustomId('blackjack_stand')
            .setLabel('Stand')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✋');

        return new ActionRowBuilder().addComponents(hitButton, standButton);
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

module.exports = BlackjackHitButton;
