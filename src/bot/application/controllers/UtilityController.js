/**
 * UtilityController
 * 
 * Handles all utility-related commands
 * Manages server info, user info, help, and other utility features
 */

const Controller = require('../../system/core/Controller');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, version: djsVersion } = require('discord.js');
const ResponseHelper = require('../../system/helpers/ResponseHelper');

class UtilityController extends Controller {
    /**
     * Create a new UtilityController instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client);

        // Load models
        this.utilityModel = this.load.model('UtilityModel');
    }

    /**
     * Safe error reply handler
     * Checks interaction state before responding to prevent "Unknown interaction" errors
     * @param {Object} interaction - Discord interaction
     * @param {string} message - Error message to display
     */
    async safeReplyError(interaction, message) {
        await this.sendError(interaction, message, true);
    }

    /**
     * Help command handler
     * Displays bot commands and features with interactive category buttons
     * @param {Object} interaction - Discord interaction
     */
    async help(interaction) {
        try {
            const modules = this.client.modules || new Map();
            const moduleList = [];
            let totalCommands = 0;

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
                totalCommands += count;
                const meta = categoryMetadata[modKey] || { emoji: '🔹', name: modKey, description: 'Module features' };
                moduleList.push({
                    emoji: meta.emoji,
                    name: meta.name,
                    description: meta.description,
                    commandsCount: count,
                });
            }

            const embed = ResponseHelper.helpMainCard(moduleList);

            // Create category navigation buttons
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

            await ResponseHelper.send(interaction, { embeds: [embed], components: [row1, row2] });
        } catch (error) {
            this.log(`Error in help command: ${error.message}`, 'error');
            await this.safeReplyError(interaction, 'Failed to display help menu');
        }
    }

    /**
     * Stats command handler
     * Displays role-based statistics (global for owner, guild-specific for regular users)
     * @param {Object} interaction - Discord interaction
     */
    async stats(interaction) {
        try {
            await interaction.deferReply();

            const ownerId = this.appConfig.ownerId || null;
            const isOwner = ownerId && interaction.user.id === ownerId;

            let embed;

            if (isOwner) {
                const stats = await this.utilityModel.getBotStats(this.client);

                embed = ResponseHelper.createEmbed({
                    color: ResponseHelper.THEMES.ADMIN,
                    title: '⚡ Global System & Bot Statistics',
                    thumbnail: this.client.user?.displayAvatarURL?.() || undefined,
                    fields: [
                        { name: '🌐 Guilds Count', value: `\`${stats.guilds}\``, inline: true },
                        { name: '👥 Total Users', value: `\`${stats.users}\``, inline: true },
                        { name: '💬 Total Channels', value: `\`${stats.channels}\``, inline: true },
                        { name: '💾 Memory Usage', value: `\`${stats.memory} MB\``, inline: true },
                        { name: '⏱️ Process Uptime', value: `\`${stats.uptime}\``, inline: true },
                        { name: '📡 WS Latency', value: `\`${this.client.ws?.ping || 0}ms\``, inline: true },
                        { name: '📦 Node.js Version', value: `\`${process.version}\``, inline: true },
                        { name: '🤖 Discord.js', value: `\`v${djsVersion}\``, inline: true },
                        { name: '🛠️ Registered Commands', value: `\`${stats.commands}\``, inline: true },
                    ],
                    footerText: 'EyeDaemon Global Management • Bot Owner View',
                });
            } else {
                const guildStats = await this.utilityModel.getGuildStats(interaction.guild);

                embed = ResponseHelper.createEmbed({
                    color: ResponseHelper.THEMES.INFO,
                    title: `📊 ${guildStats.guildName} Statistics`,
                    thumbnail: guildStats.guildIcon || undefined,
                    fields: [
                        { name: '👥 Total Members', value: `\`${guildStats.totalMembers}\` (👤 ${guildStats.humanMembers} | 🤖 ${guildStats.botMembers})`, inline: false },
                        { name: '💬 Text Channels', value: `\`${guildStats.textChannels}\``, inline: true },
                        { name: '🔊 Voice Channels', value: `\`${guildStats.voiceChannels}\``, inline: true },
                        { name: '📁 Categories', value: `\`${guildStats.categories}\``, inline: true },
                        { name: '🛡️ Roles Count', value: `\`${guildStats.totalRoles}\``, inline: true },
                        { name: '🚀 Nitro Boosts', value: `\`Level ${guildStats.boostLevel} (${guildStats.boostCount} boosts)\``, inline: true },
                        { name: '📅 Server Created', value: ResponseHelper.formatTimestamp(guildStats.createdAt, 'R'), inline: true },
                        { name: '📥 Bot Joined', value: guildStats.botJoinedAt ? ResponseHelper.formatTimestamp(guildStats.botJoinedAt, 'R') : 'Unknown', inline: true },
                    ],
                    footerText: `Server ID: ${interaction.guild?.id || 'Unknown'}`,
                });
            }

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.log(`Error in stats command: ${error.message}`, 'error');
            await this.safeReplyError(interaction, 'Failed to fetch server statistics');
        }
    }
}

module.exports = UtilityController;
