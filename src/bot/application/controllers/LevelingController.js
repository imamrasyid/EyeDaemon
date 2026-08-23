/**
 * LevelingController
 * 
 * Handles all leveling-related commands
 * Manages XP, levels, ranks, and leaderboards with ResponseHelper UI.
 */

const Controller = require('../../system/core/Controller');
const ResponseHelper = require('../../system/helpers/ResponseHelper');

class LevelingController extends Controller {
    /**
     * Create a new LevelingController instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client);

        this.levelingService = null;
        this.rewardService = null;
    }

    /**
     * Lazy load leveling service if not already available
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
     * Displays user's rank and level card
     */
    async rank(interaction) {
        try {
            const user = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;

            const service = this.getLevelingService();
            if (!service) {
                await this.sendError(interaction, 'Leveling service is currently unavailable');
                return;
            }

            const levelData = await service.getUserStats(user.id, guildId);

            if (!levelData) {
                const embed = ResponseHelper.info(
                    'No Level Data',
                    `**${user.username}** has not earned any XP in this server yet! Send a few messages to start leveling up.`
                );
                await ResponseHelper.send(interaction, embed);
                return;
            }

            const rank = await service.getUserRank(user.id, guildId);
            const embed = ResponseHelper.rankCard(user, {
                level: levelData.level,
                xp: levelData.xp,
                nextLevelXP: levelData.xpForNextLevel || 100,
                rank: rank || 1,
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.log(`Error in rank command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to fetch user rank card');
        }
    }

    /**
     * Leaderboard command handler
     * Displays server XP leaderboard
     */
    async leaderboard(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const type = interaction.options.getString('type') || 'xp';
            const limit = 10;

            const service = this.getLevelingService();
            if (!service) {
                await this.sendError(interaction, 'Leveling service is currently unavailable');
                return;
            }

            const leaderboard = await service.getLeaderboard(guildId, type, limit);

            if (!leaderboard || leaderboard.length === 0) {
                const embed = ResponseHelper.info(
                    'Server Leaderboard',
                    'No leaderboard data recorded yet for this server.'
                );
                await ResponseHelper.send(interaction, embed);
                return;
            }

            const medals = ['🥇', '🥈', '🥉'];
            const lines = leaderboard.map((entry, index) => {
                const badge = medals[index] || `\`#${(index + 1).toString().padStart(2, '0')}\``;
                const valueText = type === 'voice'
                    ? `\`${ResponseHelper.formatDuration((entry.voice_time || 0) * 60)}\` in voice`
                    : `**${ResponseHelper.formatNumber(entry.xp)} XP** (Level ${entry.level || 0})`;

                return `${badge} <@${entry.user_id}> — ${valueText}`;
            });

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.LEVELING,
                title: `🏆 ${interaction.guild.name} • ${type.toUpperCase()} Leaderboard`,
                description: [
                    `Top active members ranked by **${type === 'voice' ? 'Voice Time' : 'Experience Points (XP)'}**:`,
                    '',
                    ...lines,
                    '',
                    ResponseHelper.subtext('Rankings update automatically as you chat and participate!')
                ].join('\n'),
                footerText: `Top ${leaderboard.length} Members`
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.log(`Error in leaderboard command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to fetch leaderboard');
        }
    }

    /**
     * Give XP command handler (Admin only)
     */
    async givexp(interaction) {
        try {
            if (!interaction.member.permissions.has('Administrator')) {
                await this.sendError(interaction, 'You need **Administrator** permission to give XP.', true);
                return;
            }

            const user = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const guildId = interaction.guild.id;

            const service = this.getLevelingService();
            if (!service) {
                await this.sendError(interaction, 'Leveling service is currently unavailable');
                return;
            }

            const result = await service.addXP(user.id, guildId, amount);

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.SUCCESS,
                title: '✨ XP Granted',
                description: `Successfully awarded **+${ResponseHelper.formatNumber(amount)} XP** to ${user}!\n\n**New Total XP:** \`${ResponseHelper.formatNumber(result.newXP)} XP\` • **Current Level:** \`${result.newLevel}\``
            });

            await ResponseHelper.send(interaction, embed);
            this.log(`Admin ${interaction.user.id} gave ${amount} XP to ${user.id}`, 'info');
        } catch (error) {
            this.log(`Error in givexp command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to award XP');
        }
    }

    /**
     * Remove XP command handler (Admin only)
     */
    async removexp(interaction) {
        try {
            if (!interaction.member.permissions.has('Administrator')) {
                await this.sendError(interaction, 'You need **Administrator** permission to remove XP.', true);
                return;
            }

            const user = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const guildId = interaction.guild.id;

            const service = this.getLevelingService();
            if (!service) {
                await this.sendError(interaction, 'Leveling service is currently unavailable');
                return;
            }

            await service.removeXP(user.id, guildId, amount);

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.WARNING,
                title: '⚡ XP Deducted',
                description: `Successfully removed **-${ResponseHelper.formatNumber(amount)} XP** from ${user}.`
            });

            await ResponseHelper.send(interaction, embed);
            this.log(`Admin ${interaction.user.id} removed ${amount} XP from ${user.id}`, 'info');
        } catch (error) {
            this.log(`Error in removexp command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to remove XP');
        }
    }

    /**
     * Set level command handler (Admin only)
     */
    async setlevel(interaction) {
        try {
            if (!interaction.member.permissions.has('Administrator')) {
                await this.sendError(interaction, 'You need **Administrator** permission to set levels.', true);
                return;
            }

            const user = interaction.options.getUser('user');
            const level = interaction.options.getInteger('level');
            const guildId = interaction.guild.id;

            const service = this.getLevelingService();
            if (!service) {
                await this.sendError(interaction, 'Leveling service is currently unavailable');
                return;
            }

            await service.setLevel(user.id, guildId, level);

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.SUCCESS,
                title: '⭐ Level Updated',
                description: `Successfully adjusted ${user}'s level directly to **Level ${level}**.`
            });

            await ResponseHelper.send(interaction, embed);
            this.log(`Admin ${interaction.user.id} set ${user.id}'s level to ${level}`, 'info');
        } catch (error) {
            this.log(`Error in setlevel command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to set level');
        }
    }

    /**
     * Reset XP command handler (Admin only)
     */
    async resetxp(interaction) {
        try {
            if (!interaction.member.permissions.has('Administrator')) {
                await this.sendError(interaction, 'You need **Administrator** permission to reset XP.', true);
                return;
            }

            const user = interaction.options.getUser('user');
            const guildId = interaction.guild.id;

            const service = this.getLevelingService();
            if (!service) {
                await this.sendError(interaction, 'Leveling service is currently unavailable');
                return;
            }

            await service.resetXP(user.id, guildId);

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.WARNING,
                title: '🔄 Leveling Data Reset',
                description: `All XP and level progression for ${user} has been completely reset to Level 0.`
            });

            await ResponseHelper.send(interaction, embed);
            this.log(`Admin ${interaction.user.id} reset XP for ${user.id}`, 'info');
        } catch (error) {
            this.log(`Error in resetxp command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to reset XP');
        }
    }
}

module.exports = LevelingController;
