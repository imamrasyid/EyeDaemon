/**
 * LevelingService
 * 
 * Business logic for leveling functionality.
 * Handles XP management, level calculations, and leaderboards.
 */

const BaseService = require('../../../../system/core/BaseService');

class LevelingService extends BaseService {
    /**
     * Create a new LevelingService instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Service configuration options
     */
    constructor(client, options = {}) {
        super(client, options);
        this.levelingModel = null;
    }

    /**
     * Initialize service
     * @returns {Promise<void>}
     */
    async initialize() {
        await super.initialize();

        // Load the leveling model
        const Loader = require('../../../../system/core/Loader');
        const loader = new Loader(this.client);
        this.levelingModel = loader.model('LevelingModel');

        this.log('LevelingService initialized', 'info');
    }

    /**
     * Add XP to user
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} xp - XP to add
     * @returns {Promise<Object>} Level up information
     */
    async addXP(userId, guildId, xp) {
        try {
            this.validateRequired({ userId, guildId, xp }, ['userId', 'guildId', 'xp']);

            if (xp <= 0) {
                throw new Error('XP amount must be positive');
            }

            const result = await this.levelingModel.addXP(userId, guildId, xp);

            this.log(`Added ${xp} XP to user ${userId} in guild ${guildId}`, 'debug');

            return result;
        } catch (error) {
            throw this.handleError(error, 'addXP', { userId, guildId, xp });
        }
    }

    /**
     * Remove XP from user
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} xp - XP to remove
     * @returns {Promise<void>}
     */
    async removeXP(userId, guildId, xp) {
        try {
            this.validateRequired({ userId, guildId, xp }, ['userId', 'guildId', 'xp']);

            if (xp <= 0) {
                throw new Error('XP amount must be positive');
            }

            await this.levelingModel.removeXP(userId, guildId, xp);

            this.log(`Removed ${xp} XP from user ${userId} in guild ${guildId}`, 'debug');
        } catch (error) {
            throw this.handleError(error, 'removeXP', { userId, guildId, xp });
        }
    }

    /**
     * Set user level
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} level - Level to set
     * @returns {Promise<void>}
     */
    async setLevel(userId, guildId, level) {
        try {
            this.validateRequired({ userId, guildId, level }, ['userId', 'guildId', 'level']);

            if (level < 1) {
                throw new Error('Level must be at least 1');
            }

            await this.levelingModel.setLevel(userId, guildId, level);

            this.log(`Set level for user ${userId} in guild ${guildId} to ${level}`, 'debug');
        } catch (error) {
            throw this.handleError(error, 'setLevel', { userId, guildId, level });
        }
    }

    /**
     * Reset user XP
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<void>}
     */
    async resetXP(userId, guildId) {
        try {
            this.validateRequired({ userId, guildId }, ['userId', 'guildId']);

            await this.levelingModel.resetXP(userId, guildId);

            this.log(`Reset XP for user ${userId} in guild ${guildId}`, 'debug');
        } catch (error) {
            throw this.handleError(error, 'resetXP', { userId, guildId });
        }
    }

    /**
     * Calculate level from XP
     * @param {number} xp - Total XP
     * @returns {number} Level
     */
    calculateLevel(xp) {
        if (xp < 0) {
            return 1;
        }

        return this.levelingModel.calculateLevelFromXP(xp);
    }

    /**
     * Calculate XP required for a level
     * @param {number} level - Level
     * @returns {number} XP required
     */
    calculateXPForLevel(level) {
        if (level < 1) {
            return 0;
        }

        return this.levelingModel.calculateXPForLevel(level);
    }

    /**
     * Get user stats
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<Object>} User stats
     */
    async getUserStats(userId, guildId) {
        try {
            this.validateRequired({ userId, guildId }, ['userId', 'guildId']);

            const levelData = await this.levelingModel.getUserLevel(userId, guildId);

            if (!levelData) {
                return null;
            }

            return {
                userId,
                guildId,
                xp: levelData.xp,
                level: levelData.level,
                totalMessages: levelData.totalMessages,
                voiceTime: levelData.voiceTime,
                lastActivity: levelData.lastActivity,
                xpForNextLevel: levelData.xpForNextLevel,
                xpInCurrentLevel: levelData.xpInCurrentLevel,
                progress: levelData.progress
            };
        } catch (error) {
            throw this.handleError(error, 'getUserStats', { userId, guildId });
        }
    }

    /**
     * Get leaderboard
     * @param {string} guildId - Guild ID
     * @param {string} type - Leaderboard type ('xp', 'level', 'messages')
     * @param {number} limit - Number of users to return
     * @returns {Promise<Array>} Leaderboard data
     */
    async getLeaderboard(guildId, type = 'xp', limit = 10) {
        try {
            this.validateRequired({ guildId }, ['guildId']);

            const validTypes = ['xp', 'level', 'messages'];
            if (!validTypes.includes(type)) {
                throw new Error(`Invalid leaderboard type. Must be one of: ${validTypes.join(', ')}`);
            }

            if (limit < 1 || limit > 100) {
                throw new Error('Limit must be between 1 and 100');
            }

            const leaderboard = await this.levelingModel.getLeaderboard(guildId, type, limit);

            return leaderboard;
        } catch (error) {
            throw this.handleError(error, 'getLeaderboard', { guildId, type, limit });
        }
    }

    /**
     * Check if user leveled up
     * @param {number} oldXP - Old XP amount
     * @param {number} newXP - New XP amount
     * @returns {Object} Level up information
     */
    checkLevelUp(oldXP, newXP) {
        const oldLevel = this.calculateLevel(oldXP);
        const newLevel = this.calculateLevel(newXP);

        return {
            leveledUp: newLevel > oldLevel,
            oldLevel,
            newLevel,
            levelsGained: newLevel - oldLevel
        };
    }

    /**
     * Handle level up event
     * @param {Object} user - Discord user object
     * @param {Object} levelData - Level up data
     * @param {Object} guild - Discord guild object
     * @returns {Promise<void>}
     */
    async handleLevelUp(user, levelData, guild) {
        try {
            this.validateRequired({ user, levelData, guild }, ['user', 'levelData', 'guild']);

            if (!levelData.leveledUp) {
                return;
            }

            this.log(
                `User ${user.id} leveled up to ${levelData.newLevel} in guild ${guild.id}`,
                'info'
            );

            // Send level-up announcement
            await this.sendLevelUpAnnouncement(user, levelData, guild);

            // Apply level rewards if RewardService is available
            try {
                const rewardService = this.getRewardService();
                if (rewardService) {
                    await rewardService.syncUserRewards(user.id, guild.id, levelData.newLevel);
                }
            } catch (error) {
                this.log(`Error applying level rewards: ${error.message}`, 'warn');
            }
        } catch (error) {
            throw this.handleError(error, 'handleLevelUp', {
                userId: user?.id,
                guildId: guild?.id,
                newLevel: levelData?.newLevel
            });
        }
    }

    /**
     * Send level-up announcement to configured channel
     * @param {Object} user - Discord user
     * @param {Object} levelData - Level up data
     * @param {Object} guild - Discord guild
     * @returns {Promise<void>}
     */
    async sendLevelUpAnnouncement(user, levelData, guild) {
        try {
            const { EmbedBuilder } = require('discord.js');

            // Get announcement channel from guild settings
            let announcementChannel = null;

            try {
                const adminModule = this.client.modules.get('admin');
                if (adminModule) {
                    const guildConfigService = adminModule.getService('GuildConfigService');
                    if (guildConfigService) {
                        const channelId = await guildConfigService.getSetting(
                            guild.id,
                            'leveling_announcement_channel'
                        );
                        if (channelId) {
                            announcementChannel = guild.channels.cache.get(channelId);
                        }
                    }
                }
            } catch (error) {
                this.log(`Error getting announcement channel from config: ${error.message}`, 'warn');
            }

            // Fallback to system channel or first text channel
            if (!announcementChannel) {
                announcementChannel = guild.systemChannel;
            }

            if (!announcementChannel) {
                announcementChannel = guild.channels.cache.find(
                    channel => channel.type === 0 &&
                        channel.permissionsFor(guild.members.me).has('SendMessages')
                );
            }

            if (!announcementChannel) {
                this.log('No suitable channel found for level-up announcement', 'warn');
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle('🎉 Level Up!')
                .setDescription(`Congratulations ${user}! You've reached **Level ${levelData.newLevel}**!`)
                .addFields(
                    { name: 'Previous Level', value: `${levelData.oldLevel}`, inline: true },
                    { name: 'New Level', value: `${levelData.newLevel}`, inline: true },
                    { name: 'Total XP', value: `${levelData.newXP}`, inline: true }
                )
                .setThumbnail(user.displayAvatarURL())
                .setTimestamp();

            await announcementChannel.send({ embeds: [embed] });

            this.log(`Sent level-up announcement for user ${user.id} to channel ${announcementChannel.id}`, 'debug');
        } catch (error) {
            this.log(`Error sending level-up announcement: ${error.message}`, 'warn');
            // Don't throw error, just log it
        }
    }

    /**
     * Get RewardService instance
     * @returns {Object|null} RewardService instance or null
     */
    getRewardService() {
        try {
            const levelingModule = this.client.modules.get('leveling');
            if (levelingModule) {
                return levelingModule.getService('RewardService');
            }
        } catch (error) {
            this.log(`Error getting RewardService: ${error.message}`, 'debug');
        }
        return null;
    }
}

module.exports = LevelingService;
