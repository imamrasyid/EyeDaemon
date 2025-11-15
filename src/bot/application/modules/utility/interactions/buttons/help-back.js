/**
 * Help Back Button Interaction
 * 
 * Returns to the main help menu with category buttons.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class HelpBackButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'help_back',
            type: 'button',
        });
    }

    async execute(interaction) {
        try {
            // Create main help embed with category buttons
            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('📚 Help - EyeDaemon Bot')
                .setDescription('Select a category below to view available commands')
                .addFields(
                    { name: '🎵 Music', value: 'Music playback and queue management', inline: true },
                    { name: '💰 Economy', value: 'Currency system with games and shop', inline: true },
                    { name: '📊 Leveling', value: 'XP and leveling system with rewards', inline: true },
                    { name: '🛡️ Moderation', value: 'Moderation tools and commands', inline: true },
                    { name: '🔧 Utility', value: 'General utility commands', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true } // Empty field for alignment
                )
                .setFooter({ text: `EyeDaemon Bot v${this.client.config?.VERSION || '1.0.0'}` })
                .setTimestamp();

            // Create category buttons
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('help_music')
                        .setLabel('Music')
                        .setEmoji('🎵')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('help_economy')
                        .setLabel('Economy')
                        .setEmoji('💰')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('help_leveling')
                        .setLabel('Leveling')
                        .setEmoji('📊')
                        .setStyle(ButtonStyle.Primary)
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('help_moderation')
                        .setLabel('Moderation')
                        .setEmoji('🛡️')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('help_utility')
                        .setLabel('Utility')
                        .setEmoji('🔧')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.update({ embeds: [embed], components: [row1, row2] });

            this.log(`User ${interaction.user.tag} returned to main help menu`, 'info');
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }
}

module.exports = HelpBackButton;
