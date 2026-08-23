'use strict';

/**
 * RewardService
 * 
 * Business logic for level rewards functionality.
 * Handles reward CRUD operations and reward application to users.
 * Synchronized with consolidated schema: level_rewards (id, guild_id, level, type, data_json, created_at).
 */

const BaseService = require('../../../../system/core/BaseService');
const { randomUUID } = require('crypto');

class RewardService extends BaseService {
    constructor(client, options = {}) {
        super(client, options);
        this.tableName = 'level_rewards';
    }

    async initialize() {
        await super.initialize();
        this.log('RewardService initialized', 'info');
    }

    /**
     * Create a new reward
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

            this.validateRewardData(type, data);

            const rewardId = randomUUID();
            const dataJson = JSON.stringify(data);
            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `INSERT INTO ${this.tableName} (id, guild_id, level, type, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
                [rewardId, guildId, level, type, dataJson, now]
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
     */
    async getReward(rewardId) {
        try {
            this.validateRequired({ rewardId }, ['rewardId']);

            const results = await this.query(
                `SELECT * FROM ${this.tableName} WHERE id = ?`,
                [rewardId]
            );

            if (!results || results.length === 0) return null;

            const reward = results[0];
            const rawData = reward.data_json || reward.data || '{}';
            return {
                id: reward.id,
                guildId: reward.guild_id,
                level: reward.level,
                type: reward.type,
                data: typeof rawData === 'string' ? JSON.parse(rawData) : rawData,
                createdAt: reward.created_at
            };
        } catch (error) {
            throw this.handleError(error, 'getReward', { rewardId });
        }
    }

    /**
     * Update reward
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
                        updateFields.push(`data_json = ?`);
                        updateValues.push(JSON.stringify(value));
                    } else {
                        updateFields.push(`${key} = ?`);
                        updateValues.push(value);
                    }
                }
            }

            if (updateFields.length === 0) throw new Error('No valid fields to update');
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
     */
    async deleteReward(rewardId) {
        try {
            this.validateRequired({ rewardId }, ['rewardId']);
            await this.query(`DELETE FROM ${this.tableName} WHERE id = ?`, [rewardId]);
            this.log(`Deleted reward ${rewardId}`, 'debug');
        } catch (error) {
            throw this.handleError(error, 'deleteReward', { rewardId });
        }
    }

    /**
     * Get rewards for level
     */
    async getRewardsForLevel(guildId, level) {
        try {
            this.validateRequired({ guildId, level }, ['guildId', 'level']);

            const results = await this.query(
                `SELECT * FROM ${this.tableName} WHERE guild_id = ? AND level = ?`,
                [guildId, level]
            );

            return results.map(reward => {
                const raw = reward.data_json || reward.data || '{}';
                return {
                    id: reward.id,
                    guildId: reward.guild_id,
                    level: reward.level,
                    type: reward.type,
                    data: typeof raw === 'string' ? JSON.parse(raw) : raw,
                    createdAt: reward.created_at
                };
            });
        } catch (error) {
            throw this.handleError(error, 'getRewardsForLevel', { guildId, level });
        }
    }

    /**
     * Get all rewards for a guild
     */
    async getGuildRewards(guildId) {
        try {
            this.validateRequired({ guildId }, ['guildId']);

            const results = await this.query(
                `SELECT * FROM ${this.tableName} WHERE guild_id = ? ORDER BY level ASC`,
                [guildId]
            );

            return results.map(reward => {
                const raw = reward.data_json || reward.data || '{}';
                return {
                    id: reward.id,
                    guildId: reward.guild_id,
                    level: reward.level,
                    type: reward.type,
                    data: typeof raw === 'string' ? JSON.parse(raw) : raw,
                    createdAt: reward.created_at
                };
            });
        } catch (error) {
            throw this.handleError(error, 'getGuildRewards', { guildId });
        }
    }

    /**
     * Apply reward to user
     */
    async applyReward(userId, guildId, reward) {
        try {
            this.validateRequired({ userId, guildId, reward }, ['userId', 'guildId', 'reward']);

            const guild = this.getGuild(guildId);
            if (!guild) throw new Error('Guild not found');

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) throw new Error('Member not found');

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
     */
    async removeReward(userId, guildId, reward) {
        try {
            this.validateRequired({ userId, guildId, reward }, ['userId', 'guildId', 'reward']);

            const guild = this.getGuild(guildId);
            if (!guild) throw new Error('Guild not found');

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) throw new Error('Member not found');

            switch (reward.type) {
                case 'role':
                    await this.removeRoleReward(member, reward.data);
                    break;
                case 'currency':
                case 'item':
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
     * Sync user rewards
     */
    async syncUserRewards(userId, guildId, currentLevel) {
        try {
            this.validateRequired({ userId, guildId, currentLevel }, ['userId', 'guildId', 'currentLevel']);

            const allRewards = await this.getGuildRewards(guildId);

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

    async applyRoleReward(member, data) {
        if (!data.roleId) throw new Error('Role reward data must include roleId');

        const role = member.guild.roles.cache.get(data.roleId);
        if (!role) throw new Error(`Role ${data.roleId} not found`);

        if (member.roles.cache.has(data.roleId)) return;

        if (!member.guild.members.me.permissions.has('ManageRoles')) {
            throw new Error('Bot does not have ManageRoles permission');
        }

        if (role.position >= member.guild.members.me.roles.highest.position) {
            throw new Error('Cannot assign role: role is higher than bot role');
        }

        await member.roles.add(role);
    }

    async removeRoleReward(member, data) {
        if (!data.roleId) throw new Error('Role reward data must include roleId');

        const role = member.guild.roles.cache.get(data.roleId);
        if (!role) return;

        if (!member.roles.cache.has(data.roleId)) return;

        await member.roles.remove(role);
    }

    async applyCurrencyReward(userId, guildId, data) {
        if (!data.amount || data.amount <= 0) throw new Error('Currency reward data must include positive amount');

        const economyModule = this.client.modules.get('economy');
        if (!economyModule) throw new Error('Economy module not available');

        const economyService = economyModule.getService('EconomyService');
        if (!economyService) throw new Error('EconomyService not available');

        await economyService.addBalance(userId, guildId, data.amount, 'Level reward');
    }

    async applyItemReward(userId, guildId, data) {
        if (!data.itemId) throw new Error('Item reward data must include itemId');

        const economyModule = this.client.modules.get('economy');
        if (!economyModule) throw new Error('Economy module not available');

        const shopService = economyModule.getService('ShopService');
        if (!shopService) throw new Error('ShopService not available');

        await shopService.purchaseItem(userId, guildId, data.itemId, data.quantity || 1);
    }

    validateRewardData(type, data) {
        switch (type) {
            case 'role':
                if (!data.roleId) throw new Error('Role reward must include roleId');
                break;
            case 'currency':
                if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0) {
                    throw new Error('Currency reward must include positive amount');
                }
                break;
            case 'item':
                if (!data.itemId) throw new Error('Item reward must include itemId');
                break;
            default:
                throw new Error(`Unknown reward type: ${type}`);
        }
    }
}

module.exports = RewardService;
