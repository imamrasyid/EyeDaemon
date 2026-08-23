/**
 * Help Back Button Interaction
 * 
 * Returns to the main help menu with category buttons using ResponseHelper.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ResponseHelper = require('../../../../../system/helpers/ResponseHelper');

class HelpBackButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'help_back',
            type: 'button',
        });
    }

    async execute(interaction) {
        try {
            const modules = this.client.modules || new Map();
            const moduleList = [];

            const categoryMetadata = {
                music: { emoji: '🎵', name: 'Music', description: 'Audio streaming, equalizer filters & playlist management' },
                economy: { emoji: '💰', name: 'Economy', description: 'Currency system, Blackjack casino, shop & inventory' },
                leveling: { emoji: '📊', name: 'Leveling', description: 'XP progression, server rank cards & leaderboards' },
                moderation: { emoji: '🛡️', name: 'Moderation', description: 'Server security, auto-moderation, kick/ban & purge' },
                ticket: { emoji: '🎫', name: 'Ticket Support', description: 'Multi-category ticket channels & staff management' },
                admin: { emoji: '⚙️', name: 'Administration', description: 'Server configuration & system performance monitoring' },
                utility: { emoji: '🔧', name: 'Utility', description: 'General server statistics, bot info & help guides' },
            };

            for (const [modKey, mod] of modules) {
                const count = (mod.commands || []).length;
                const meta = categoryMetadata[modKey] || { emoji: '🔹', name: modKey, description: 'Module features' };
                moduleList.push({
                    emoji: meta.emoji,
                    name: meta.name,
                    description: meta.description,
                    commandsCount: count,
                });
            }

            const embed = ResponseHelper.helpMainCard(moduleList);

            // Create category buttons
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('help_music').setLabel('Music').setEmoji('🎵').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('help_economy').setLabel('Economy').setEmoji('💰').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('help_leveling').setLabel('Leveling').setEmoji('📊').setStyle(ButtonStyle.Primary)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('help_moderation').setLabel('Moderation').setEmoji('🛡️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('help_utility').setLabel('Utility').setEmoji('🔧').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('help_admin').setLabel('Admin').setEmoji('⚙️').setStyle(ButtonStyle.Primary)
            );

            await interaction.deferUpdate();
            await interaction.editReply({ embeds: [embed], components: [row1, row2] });

            this.log(`User ${interaction.user.tag} returned to main help menu`, 'info');
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }
}

module.exports = HelpBackButton;
