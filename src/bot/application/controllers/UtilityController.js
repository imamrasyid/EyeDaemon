/**
 * UtilityController
 * 
 * Handles all utility-related commands
 * Manages server info, user info, help, and other utility features
 */

const Controller = require('../../system/core/Controller');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, version: djsVersion } = require('discord.js');

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
        try {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setDescription(`❌ ${message}`);

            const payload = {
                embeds: [errorEmbed],
                flags: MessageFlags.Ephemeral
            };

            // Check interaction state and use appropriate response method
            if (interaction.replied || interaction.deferred) {
                if (interaction.replied) {
                    // Interaction already replied, use followUp
                    await interaction.followUp(payload);
                } else {
                    // Interaction deferred but not replied, use editReply
                    await interaction.editReply(payload);
                }
            } else {
                // Fresh interaction, use reply
                await interaction.reply(payload);
            }
        } catch (error) {
            // Log error but don't throw to prevent cascading errors
            this.log(`Failed to send error message: ${error.message}`, 'error');
        }
    }

    /**
     * Help command handler
     * Displays bot commands and features with interactive category buttons
     * @param {Object} interaction - Discord interaction
     */
    async help(interaction) {
        try {
            // Count total commands
            let totalCommands = 0;
            const modules = this.client.modules || new Map();
            for (const [, module] of modules) {
                totalCommands += (module.commands || []).length;
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('📚 Help - EyeDaemon Bot')
                .setDescription(
                    `Welcome to EyeDaemon Bot! I have **${totalCommands} commands** across multiple categories.\n\n` +
                    `**How to use commands:**\n` +
                    `• Slash commands: \`/command\` (Recommended)\n` +
                    `• Text commands: \`!command\` (Legacy support)\n\n` +
                    `Select a category below to view detailed command information.`
                )
                .addFields(
                    { name: '🎵 Music', value: 'Music playback, queue management, and playlists', inline: true },
                    { name: '💰 Economy', value: 'Currency system, games, shop, and trading', inline: true },
                    { name: '📊 Leveling', value: 'XP tracking, levels, and leaderboards', inline: true },
                    { name: '🛡️ Moderation', value: 'Moderation tools, warnings, and logs', inline: true },
                    { name: '🔧 Utility', value: 'Server info, stats, and utility commands', inline: true },
                    { name: '⚙️ Admin', value: 'Server configuration and management', inline: true }
                )
                .setFooter({ text: `EyeDaemon Bot v${this.appConfig.VERSION || '1.0.0'} | Total Commands: ${totalCommands}` })
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
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('help_admin')
                        .setLabel('Admin')
                        .setEmoji('⚙️')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.reply({ embeds: [embed], components: [row1, row2] });
        } catch (error) {
            this.log(`Error in help command: ${error.message}`, 'error');
            await this.safeReplyError(interaction, 'Failed to display help');
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

            // Subtask 3.1: Implement owner detection logic
            const ownerId = this.appConfig.ownerId || null;
            const isOwner = ownerId && interaction.user.id === ownerId;

            let embed;

            if (isOwner) {
                // Subtask 3.2: Implement global stats display for bot owner
                const stats = await this.utilityModel.getBotStats(this.client);

                embed = new EmbedBuilder()
                    .setColor(0x3498db) // Blue color for global stats
                    .setTitle('📊 Global Bot Statistics')
                    .addFields(
                        { name: 'Guilds', value: `${stats.guilds}`, inline: true },
                        { name: 'Users', value: `${stats.users}`, inline: true },
                        { name: 'Channels', value: `${stats.channels}`, inline: true },
                        { name: 'Memory', value: `${stats.memory} MB`, inline: true },
                        { name: 'Uptime', value: stats.uptime, inline: true },
                        { name: 'Commands', value: `${stats.commands}`, inline: true },
                        { name: 'Node.js', value: process.version, inline: true },
                        { name: 'Discord.js', value: djsVersion, inline: true },
                        { name: 'Ping', value: `${this.client.ws.ping}ms`, inline: true }
                    )
                    .setTimestamp();
            } else {
                // Subtask 3.3: Implement guild stats display for regular users
                const guildStats = await this.utilityModel.getGuildStats(interaction.guild);

                embed = new EmbedBuilder()
                    .setColor(0x2ecc71) // Green color for guild stats
                    .setTitle('📊 Guild Statistics')
                    .setAuthor({
                        name: guildStats.guildName,
                        iconURL: guildStats.guildIcon
                    })
                    .addFields(
                        { name: 'Total Members', value: `${guildStats.totalMembers}`, inline: true },
                        { name: 'Humans', value: `${guildStats.humanMembers}`, inline: true },
                        { name: 'Bots', value: `${guildStats.botMembers}`, inline: true },
                        { name: 'Text Channels', value: `${guildStats.textChannels}`, inline: true },
                        { name: 'Voice Channels', value: `${guildStats.voiceChannels}`, inline: true },
                        { name: 'Categories', value: `${guildStats.categories}`, inline: true },
                        { name: 'Total Channels', value: `${guildStats.totalChannels}`, inline: true },
                        { name: 'Roles', value: `${guildStats.totalRoles}`, inline: true },
                        { name: 'Boost Level', value: `${guildStats.boostLevel}`, inline: true },
                        { name: 'Boost Count', value: `${guildStats.boostCount}`, inline: true },
                        { name: 'Created', value: `<t:${Math.floor(guildStats.createdAt.getTime() / 1000)}:R>`, inline: true },
                        { name: 'Bot Joined', value: guildStats.botJoinedAt ? `<t:${Math.floor(guildStats.botJoinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true }
                    )
                    .setTimestamp();
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            this.log(`Error in stats command: ${error.message}`, 'error');
            // Subtask 3.4: Update error handling to use safeReplyError
            await this.safeReplyError(interaction, 'Failed to fetch statistics');
        }
    }


}

module.exports = UtilityController;
