/**
 * RewardService
 * 
 * Business logic for level rewards functionality.
 * Handles reward CRUD operations and reward application to users.
 */

const BaseService = require('../../../../system/core/BaseService');

class RewardService extends BaseService {
    /**
     * Create a new RewardService instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Service configuration options
     */
    constructor(client, options = {}) {
        super(client, options);
        this.tableName = 'level_rewards';
    }

    /**
     * Initialize service
     * @returns {Promise<void>}
     */
    async initialize() {
        await super.initialize();
        this.log('RewardService initialized', 'info');
    }

    /**
     * Create a new reward
     * @param {string} guildId - Guild ID
     * @param {number} level - Level to grant reward at
     * @param {string} type - Reward type ('role', 'currency', 'item')
     * @param {Object} data - Reward data (depends on type)
     * @returns {Promise<Object>} Created reward
     */
    async createReward(guildId, level, type, data) {
        try {
            this.validateRequired({ guildId, level, type, data }, ['guildId', 'level', 'type', 'data']);

            const validTypes = ['role', 'currency', 'item'];
            if (!validTypes.includes(type)) {
                throw new Error(`Invalid reward type. Must be one of: ${validTypes.join(', ')}`);
            }

            if (level < 1) {
                throw new Error('Level must be at least 1');
            }

            // Validate data based on type
            this.validateRewardData(type, data);

            const rewardId = `${guildId}-${level}-${type}-${Date.now()}`;
            const dataJson = JSON.stringify(data);

            await this.query(
                `INSERT INTO ${this.tableName} (id, guild_id, level, type, data) VALUES (?, ?, ?, ?, ?)`,
                [rewardId, guildId, level, type, dataJson]
            );

            this.log(`Created reward ${rewardId} for level ${level} in guild ${guildId}`, 'debug');

            return {
                id: rewardId,
                guildId,
                level,
                type,
                data
            };
        } catch (error) {
            throw this.handleError(error, 'createReward', { guildId, level, type });
        }
    }

    /**
     * Get reward by ID
     * @param {string} rewardId - Reward ID
     * @returns {Promise<Object|null>} Reward or null
     */
    async getReward(rewardId) {
        try {
            this.validateRequired({ rewardId }, ['rewardId']);

            const results = await this.query(
                `SELECT * FROM ${this.tableName} WHERE id = ?`,
                [rewardId]
            );

            if (!results || results.length === 0) {
                return null;
            }

            const reward = results[0];
            return {
                id: reward.id,
                guildId: reward.guild_id,
                level: reward.level,
                type: reward.type,
                data: JSON.parse(reward.data),
                createdAt: reward.created_at
            };
        } catch (error) {
            throw this.handleError(error, 'getReward', { rewardId });
        }
    }

    /**
     * Update reward
     * @param {string} rewardId - Reward ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<void>}
     */
    async updateReward(rewardId, updates) {
        try {
            this.validateRequired({ rewardId }, ['rewardId']);

            const allowedFields = ['level', 'type', 'data'];
            const updateFields = [];
            const updateValues = [];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    if (key === 'data') {
                        updateFields.push(`${key} = ?`);
                        updateValues.push(JSON.stringify(value));
                    } else {
                        updateFields.push(`${key} = ?`);
                        updateValues.push(value);
                    }
                }
            }

            if (updateFields.length === 0) {
                throw new Error('No valid fields to update');
            }

            updateValues.push(rewardId);

            await this.query(
                `UPDATE ${this.tableName} SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
            );

            this.log(`Updated reward ${rewardId}`, 'debug');
        } catch (error) {
            throw this.handleError(error, 'updateReward', { rewardId, updates });
        }
    }

    /**
     * Delete reward
     * @param {string} rewardId - Reward ID
     * @returns {Promise<void>}
     */
    async deleteReward(rewardId) {
        try {
            this.validateRequired({ rewardId }, ['rewardId']);

            await this.query(
                `DELETE FROM ${this.tableName} WHERE id = ?`,
                [rewardId]
            );

            this.log(`Deleted reward ${rewardId}`, 'debug');
        } catch (error) {
            throw this.handleError(error, 'deleteReward', { rewardId });
        }
    }

    /**
     * Get rewards for a specific level
     * @param {string} guildId - Guild ID
     * @param {number} level - Level
     * @returns {Promise<Array>} Rewards for the level
     */
    async getRewardsForLevel(guildId, level) {
        try {
            this.validateRequired({ guildId, level }, ['guildId', 'level']);

            const results = await this.query(
                `SELECT * FROM ${this.tableName} WHERE guild_id = ? AND level = ?`,
                [guildId, level]
            );

            return results.map(reward => ({
                id: reward.id,
                guildId: reward.guild_id,
                level: reward.level,
                type: reward.type,
                data: JSON.parse(reward.data),
                createdAt: reward.created_at
            }));
        } catch (error) {
            throw this.handleError(error, 'getRewardsForLevel', { guildId, level });
        }
    }

    /**
     * Get all rewards for a guild
     * @param {string} guildId - Guild ID
     * @returns {Promise<Array>} All rewards for the guild
     */
    async getGuildRewards(guildId) {
        try {
            this.validateRequired({ guildId }, ['guildId']);

            const results = await this.query(
                `SELECT * FROM ${this.tableName} WHERE guild_id = ? ORDER BY level ASC`,
                [guildId]
            );

            return results.map(reward => ({
                id: reward.id,
                guildId: reward.guild_id,
                level: reward.level,
                type: reward.type,
                data: JSON.parse(reward.data),
                createdAt: reward.created_at
            }));
        } catch (error) {
            throw this.handleError(error, 'getGuildRewards', { guildId });
        }
    }

    /**
     * Apply reward to user
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {Object} reward - Reward object
     * @returns {Promise<void>}
     */
    async applyReward(userId, guildId, reward) {
        try {
            this.validateRequired({ userId, guildId, reward }, ['userId', 'guildId', 'reward']);

            const guild = this.getGuild(guildId);
            if (!guild) {
                throw new Error('Guild not found');
            }

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) {
                throw new Error('Member not found');
            }

            switch (reward.type) {
                case 'role':
                    await this.applyRoleReward(member, reward.data);
                    break;
                case 'currency':
                    await this.applyCurrencyReward(userId, guildId, reward.data);
                    break;
                case 'item':
                    await this.applyItemReward(userId, guildId, reward.data);
                    break;
                default:
                    throw new Error(`Unknown reward type: ${reward.type}`);
            }

            this.log(`Applied ${reward.type} reward to user ${userId} in guild ${guildId}`, 'info');
        } catch (error) {
            throw this.handleError(error, 'applyReward', { userId, guildId, rewardType: reward?.type });
        }
    }

    /**
     * Remove reward from user
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {Object} reward - Reward object
     * @returns {Promise<void>}
     */
    async removeReward(userId, guildId, reward) {
        try {
            this.validateRequired({ userId, guildId, reward }, ['userId', 'guildId', 'reward']);

            const guild = this.getGuild(guildId);
            if (!guild) {
                throw new Error('Guild not found');
            }

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) {
                throw new Error('Member not found');
            }

            switch (reward.type) {
                case 'role':
                    await this.removeRoleReward(member, reward.data);
                    break;
                case 'currency':
                    // Currency rewards are not removed
                    this.log('Currency rewards cannot be removed', 'debug');
                    break;
                case 'item':
                    // Item rewards are not removed
                    this.log('Item rewards cannot be removed', 'debug');
                    break;
                default:
                    throw new Error(`Unknown reward type: ${reward.type}`);
            }

            this.log(`Removed ${reward.type} reward from user ${userId} in guild ${guildId}`, 'info');
        } catch (error) {
            throw this.handleError(error, 'removeReward', { userId, guildId, rewardType: reward?.type });
        }
    }

    /**
     * Sync user rewards based on current level
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} currentLevel - User's current level
     * @returns {Promise<void>}
     */
    async syncUserRewards(userId, guildId, currentLevel) {
        try {
            this.validateRequired({ userId, guildId, currentLevel }, ['userId', 'guildId', 'currentLevel']);

            // Get all rewards for the guild
            const allRewards = await this.getGuildRewards(guildId);

            // Apply rewards for levels up to current level
            for (const reward of allRewards) {
                if (reward.level <= currentLevel) {
                    try {
                        await this.applyReward(userId, guildId, reward);
                    } catch (error) {
                        this.log(`Error applying reward ${reward.id}: ${error.message}`, 'warn');
                    }
                }
            }

            this.log(`Synced rewards for user ${userId} at level ${currentLevel} in guild ${guildId}`, 'debug');
        } catch (error) {
            throw this.handleError(error, 'syncUserRewards', { userId, guildId, currentLevel });
        }
    }

    /**
     * Apply role reward to member
     * @param {Object} member - Discord member
     * @param {Object} data - Reward data with roleId
     * @returns {Promise<void>}
     */
    async applyRoleReward(member, data) {
        if (!data.roleId) {
            throw new Error('Role reward data must include roleId');
        }

        const role = member.guild.roles.cache.get(data.roleId);
        if (!role) {
            throw new Error(`Role ${data.roleId} not found`);
        }

        // Check if member already has the role
        if (member.roles.cache.has(data.roleId)) {
            this.log(`Member ${member.id} already has role ${data.roleId}`, 'debug');
            return;
        }

        // Check bot permissions
        if (!member.guild.members.me.permissions.has('ManageRoles')) {
            throw new Error('Bot does not have ManageRoles permission');
        }

        // Check role hierarchy
        if (role.position >= member.guild.members.me.roles.highest.position) {
            throw new Error('Cannot assign role: role is higher than bot\'s highest role');
        }

        await member.roles.add(role);
        this.log(`Added role ${data.roleId} to member ${member.id}`, 'debug');
    }

    /**
     * Remove role reward from member
     * @param {Object} member - Discord member
     * @param {Object} data - Reward data with roleId
     * @returns {Promise<void>}
     */
    async removeRoleReward(member, data) {
        if (!data.roleId) {
            throw new Error('Role reward data must include roleId');
        }

        const role = member.guild.roles.cache.get(data.roleId);
        if (!role) {
            this.log(`Role ${data.roleId} not found, skipping removal`, 'debug');
            return;
        }

        // Check if member has the role
        if (!member.roles.cache.has(data.roleId)) {
            this.log(`Member ${member.id} does not have role ${data.roleId}`, 'debug');
            return;
        }

        await member.roles.remove(role);
        this.log(`Removed role ${data.roleId} from member ${member.id}`, 'debug');
    }

    /**
     * Apply currency reward to user
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {Object} data - Reward data with amount
     * @returns {Promise<void>}
     */
    async applyCurrencyReward(userId, guildId, data) {
        if (!data.amount || data.amount <= 0) {
            throw new Error('Currency reward data must include positive amount');
        }

        try {
            const economyModule = this.client.modules.get('economy');
            if (!economyModule) {
                throw new Error('Economy module not available');
            }

            const economyService = economyModule.getService('EconomyService');
            if (!economyService) {
                throw new Error('EconomyService not available');
            }

            await economyService.addBalance(userId, guildId, data.amount);
            this.log(`Added ${data.amount} currency to user ${userId}`, 'debug');
        } catch (error) {
            throw new Error(`Failed to apply currency reward: ${error.message}`);
        }
    }

    /**
     * Apply item reward to user
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {Object} data - Reward data with itemId
     * @returns {Promise<void>}
     */
    async applyItemReward(userId, guildId, data) {
        if (!data.itemId) {
            throw new Error('Item reward data must include itemId');
        }

        try {
            const economyModule = this.client.modules.get('economy');
            if (!economyModule) {
                throw new Error('Economy module not available');
            }

            const shopService = economyModule.getService('ShopService');
            if (!shopService) {
                throw new Error('ShopService not available');
            }

            // Add item to user's inventory
            await shopService.addToInventory(userId, guildId, data.itemId, data.quantity || 1);
            this.log(`Added item ${data.itemId} to user ${userId}'s inventory`, 'debug');
        } catch (error) {
            throw new Error(`Failed to apply item reward: ${error.message}`);
        }
    }

    /**
     * Validate reward data based on type
     * @param {string} type - Reward type
     * @param {Object} data - Reward data
     * @throws {Error} If data is invalid
     */
    validateRewardData(type, data) {
        switch (type) {
            case 'role':
                if (!data.roleId) {
                    throw new Error('Role reward must include roleId');
                }
                break;
            case 'currency':
                if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0) {
                    throw new Error('Currency reward must include positive amount');
                }
                break;
            case 'item':
                if (!data.itemId) {
                    throw new Error('Item reward must include itemId');
                }
                if (data.quantity && (typeof data.quantity !== 'number' || data.quantity <= 0)) {
                    throw new Error('Item quantity must be a positive number');
                }
                break;
            default:
                throw new Error(`Unknown reward type: ${type}`);
        }
    }
}

module.exports = RewardService;
