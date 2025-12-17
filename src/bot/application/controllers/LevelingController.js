/**
 * LevelingController
 * 
 * Handles all leveling-related commands
 * Manages XP, levels, ranks, and rewards
 */

const Controller = require('../../system/core/Controller');
const { EmbedBuilder } = require('discord.js');

class LevelingController extends Controller {
    /**
     * Create a new LevelingController instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client);

        // Load services
        this.levelingService = null;
        this.rewardService = null;
    }

    /**
     * Initialize controller and load services
     */
    async initialize() {
        const levelingModule = this.client.modules.get('leveling');
        if (levelingModule) {
            this.levelingService = levelingModule.getService('LevelingService');
            this.rewardService = levelingModule.getService('RewardService');
        }

        if (!this.levelingService) {
            this.log('LevelingService not available', 'warn');
        }
    }

    /**
     * Lazy load leveling service if not already available.
     * Prevents null access when initialize was not awaited.
     * @returns {Object|null} LevelingService instance
     */
    getLevelingService() {
        if (this.levelingService) return this.levelingService;

        const levelingModule = this.client.modules.get('leveling');
        if (levelingModule) {
            this.levelingService = levelingModule.getService('LevelingService');
            this.rewardService = levelingModule.getService('RewardService');
        }

        return this.levelingService;
    }

    /**
     * Rank command handler
     * Displays user's rank and level
     * @param {Object} interaction - Discord interaction
     */
    async rank(interaction) {
        try {
            const user = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;

            const service = this.getLevelingService();
            if (!service) {
                await this.sendError(interaction, 'Leveling service unavailable');
                return;
            }

            const levelData = await service.getUserStats(user.id, guildId);

            if (!levelData) {
                await interaction.reply({ content: '❌ No leveling data found for this user' });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle(`📊 Rank - ${user.tag}`)
                .addFields(
                    { name: 'Level', value: `${levelData.level}`, inline: true },
                    { name: 'XP', value: `${levelData.xp}`, inline: true },
                    { name: 'Messages', value: `${levelData.totalMessages}`, inline: true },
                    { name: 'Progress', value: `${levelData.progress.toFixed(1)}%`, inline: true },
                    { name: 'XP to Next Level', value: `${levelData.xpForNextLevel - levelData.xp}`, inline: true }
                )
                .setThumbnail(user.displayAvatarURL())
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            this.log(`Error in rank command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to fetch rank');
        }
    }

    /**
     * Leaderboard command handler
     * Displays server leaderboard
     * @param {Object} interaction - Discord interaction
     */
    async leaderboard(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const type = interaction.options.getString('type') || 'xp';
            const limit = 10;

            const service = this.getLevelingService();
            if (!service) {
                await this.sendError(interaction, 'Leveling service unavailable');
                return;
            }

            const leaderboard = await service.getLeaderboard(guildId, type, limit);

            if (leaderboard.length === 0) {
                await interaction.editReply({ content: '❌ No leaderboard data available' });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle(`🏆 Leaderboard - ${type.toUpperCase()}`)
                .setDescription(await this.formatLeaderboard(leaderboard, type))
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            this.log(`Error in leaderboard command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to fetch leaderboard');
        }
    }

    /**
     * Give XP command handler (Admin only)
     * Gives XP to a user
     * @param {Object} interaction - Discord interaction
     */
    async givexp(interaction) {
        try {
            const user = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const guildId = interaction.guild.id;

            const service = this.getLevelingService();
            if (!service) {
                await this.sendError(interaction, 'Leveling service unavailable');
                return;
            }

            const result = await service.addXP(user.id, guildId, amount);

            // Handle level-up if user leveled up
            if (result.leveledUp) {
                await this.levelingService.handleLevelUp(user, result, interaction.guild);
            }

            await interaction.reply(`✅ Gave **${amount} XP** to ${user}`);
            this.log(`Admin ${interaction.user.id} gave ${amount} XP to ${user.id}`, 'info');
        } catch (error) {
            this.log(`Error in givexp command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to give XP');
        }
    }

    /**
     * Remove XP command handler (Admin only)
     * Removes XP from a user
     * @param {Object} interaction - Discord interaction
     */
    async removexp(interaction) {
        try {
            const user = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const guildId = interaction.guild.id;

            const service = this.getLevelingService();
            if (!service) {
                await this.sendError(interaction, 'Leveling service unavailable');
                return;
            }

            await service.removeXP(user.id, guildId, amount);

            await interaction.reply(`✅ Removed **${amount} XP** from ${user}`);
            this.log(`Admin ${interaction.user.id} removed ${amount} XP from ${user.id}`, 'info');
        } catch (error) {
            this.log(`Error in removexp command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to remove XP');
        }
    }

    /**
     * Set level command handler (Admin only)
     * Sets user's level
     * @param {Object} interaction - Discord interaction
     */
    async setlevel(interaction) {
        try {
            const user = interaction.options.getUser('user');
            const level = interaction.options.getInteger('level');
            const guildId = interaction.guild.id;

            const service = this.getLevelingService();
            if (!service) {
                await this.sendError(interaction, 'Leveling service unavailable');
                return;
            }

            await service.setLevel(user.id, guildId, level);

            await interaction.reply(`✅ Set ${user}'s level to **${level}**`);
            this.log(`Admin ${interaction.user.id} set ${user.id}'s level to ${level}`, 'info');
        } catch (error) {
            this.log(`Error in setlevel command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to set level');
        }
    }

    /**
     * Reset XP command handler (Admin only)
     * Resets user's XP
     * @param {Object} interaction - Discord interaction
     */
    async resetxp(interaction) {
        try {
            const user = interaction.options.getUser('user');
            const guildId = interaction.guild.id;

            const service = this.getLevelingService();
            if (!service) {
                await this.sendError(interaction, 'Leveling service unavailable');
                return;
            }

            await service.resetXP(user.id, guildId);

            await interaction.reply(`✅ Reset ${user}'s XP and level`);
            this.log(`Admin ${interaction.user.id} reset ${user.id}'s XP`, 'info');
        } catch (error) {
            this.log(`Error in resetxp command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to reset XP');
        }
    }

    /**
     * Format leaderboard data
     * @param {Array} leaderboard - Leaderboard data
     * @param {string} type - Leaderboard type
     * @returns {Promise<string>} Formatted leaderboard
     */
    async formatLeaderboard(leaderboard, type) {
        const lines = [];

        for (const entry of leaderboard) {
            const user = await this.client.users.fetch(entry.userId).catch(() => null);
            const username = user ? user.tag : 'Unknown User';

            let value;
            switch (type) {
                case 'level':
                    value = `Level ${entry.level}`;
                    break;
                case 'messages':
                    value = `${entry.totalMessages} messages`;
                    break;
                default:
                    value = `${entry.xp} XP`;
            }

            const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `**${entry.rank}.**`;
            lines.push(`${medal} ${username} - ${value}`);
        }

        return lines.join('\n');
    }
}

module.exports = LevelingController;
