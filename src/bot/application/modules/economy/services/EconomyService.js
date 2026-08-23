'use strict';

/**
 * EconomyService
 * 
 * Business logic for economy operations including balance management,
 * transfers, deposits, withdrawals, and transaction logging.
 * Synchronized with consolidated schema.
 */

const BaseService = require('../../../../system/core/BaseService');

class EconomyService extends BaseService {
    constructor(client, options = {}) {
        super(client, options);
        this.economyModel = null;
    }

    async initialize() {
        await super.initialize();

        const loader = this.client.loader;
        if (loader) {
            this.economyModel = loader.model('EconomyModel');
        }

        this.log('EconomyService initialized', 'info');
    }

    /**
     * Get user balance
     * @param {string} userId
     * @param {string} guildId
     * @returns {Promise<Object>}
     */
    async getBalance(userId, guildId) {
        this.validateRequired({ userId, guildId }, ['userId', 'guildId']);

        try {
            const balance = await this.economyModel.getUserBalance(userId, guildId);

            return {
                wallet: balance.balance || 0,
                bank: balance.bank_balance || 0,
                total: (balance.balance || 0) + (balance.bank_balance || 0)
            };
        } catch (error) {
            throw this.handleError(error, 'getBalance', { userId, guildId });
        }
    }

    /**
     * Claim daily reward
     * @param {string} userId
     * @param {string} guildId
     * @returns {Promise<Object>}
     */
    async claimDaily(userId, guildId) {
        this.validateRequired({ userId, guildId }, ['userId', 'guildId']);

        try {
            return await this.economyModel.claimDaily(userId, guildId);
        } catch (error) {
            throw this.handleError(error, 'claimDaily', { userId, guildId });
        }
    }

    /**
     * Work
     * @param {string} userId
     * @param {string} guildId
     * @returns {Promise<Object>}
     */
    async work(userId, guildId) {
        this.validateRequired({ userId, guildId }, ['userId', 'guildId']);

        try {
            return await this.economyModel.work(userId, guildId);
        } catch (error) {
            throw this.handleError(error, 'work', { userId, guildId });
        }
    }

    /**
     * Get leaderboard
     * @param {string} guildId
     * @param {string} type
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getLeaderboard(guildId, type = 'wallet', limit = 10) {
        this.validateRequired({ guildId }, ['guildId']);

        try {
            return await this.economyModel.getLeaderboard(guildId, type, limit);
        } catch (error) {
            throw this.handleError(error, 'getLeaderboard', { guildId, type, limit });
        }
    }

    /**
     * Get transaction history
     * @param {string} guildId
     * @param {string} [userId]
     * @param {number} [limit]
     * @returns {Promise<Array>}
     */
    async getTransactionHistory(guildId, userId = null, limit = 50) {
        this.validateRequired({ guildId }, ['guildId']);

        try {
            return await this.economyModel.getTransactionHistory(guildId, userId, limit);
        } catch (error) {
            throw this.handleError(error, 'getTransactionHistory', { guildId, userId, limit });
        }
    }

    /**
     * Add balance
     * @param {string} userId
     * @param {string} guildId
     * @param {number} amount
     * @param {string} reason
     * @returns {Promise<Object>}
     */
    async addBalance(userId, guildId, amount, reason = 'Unknown') {
        this.validateRequired({ userId, guildId, amount }, ['userId', 'guildId', 'amount']);

        if (amount <= 0) {
            throw new Error('Amount must be positive');
        }

        try {
            await this.economyModel.updateBalance(userId, guildId, amount, 'balance', 'add', reason);
            const newBalance = await this.getBalance(userId, guildId);

            return {
                success: true,
                amount,
                newBalance: newBalance.wallet,
                totalBalance: newBalance.total
            };
        } catch (error) {
            throw this.handleError(error, 'addBalance', { userId, guildId, amount, reason });
        }
    }

    /**
     * Remove balance
     * @param {string} userId
     * @param {string} guildId
     * @param {number} amount
     * @param {string} reason
     * @returns {Promise<Object>}
     */
    async removeBalance(userId, guildId, amount, reason = 'Unknown') {
        this.validateRequired({ userId, guildId, amount }, ['userId', 'guildId', 'amount']);

        if (amount <= 0) {
            throw new Error('Amount must be positive');
        }

        try {
            const currentBalance = await this.getBalance(userId, guildId);

            if (currentBalance.wallet < amount) {
                return {
                    success: false,
                    message: 'Insufficient balance',
                    required: amount,
                    available: currentBalance.wallet
                };
            }

            await this.economyModel.updateBalance(userId, guildId, -amount, 'balance', 'remove', reason);
            const newBalance = await this.getBalance(userId, guildId);

            return {
                success: true,
                amount,
                newBalance: newBalance.wallet,
                totalBalance: newBalance.total
            };
        } catch (error) {
            throw this.handleError(error, 'removeBalance', { userId, guildId, amount, reason });
        }
    }

    /**
     * Transfer
     * @param {string} fromUserId
     * @param {string} toUserId
     * @param {string} guildId
     * @param {number} amount
     * @returns {Promise<Object>}
     */
    async transfer(fromUserId, toUserId, guildId, amount) {
        this.validateRequired(
            { fromUserId, toUserId, guildId, amount },
            ['fromUserId', 'toUserId', 'guildId', 'amount']
        );

        if (amount <= 0) throw new Error('Amount must be positive');
        if (fromUserId === toUserId) return { success: false, message: 'Cannot transfer to yourself' };

        try {
            const result = await this.economyModel.transfer(fromUserId, toUserId, guildId, amount);
            if (!result.success) return result;

            const newBalance = await this.getBalance(fromUserId, guildId);
            return {
                success: true,
                amount,
                newBalance: newBalance.wallet,
                totalBalance: newBalance.total
            };
        } catch (error) {
            throw this.handleError(error, 'transfer', { fromUserId, toUserId, guildId, amount });
        }
    }

    /**
     * Deposit
     * @param {string} userId
     * @param {string} guildId
     * @param {number} amount
     * @returns {Promise<Object>}
     */
    async deposit(userId, guildId, amount) {
        this.validateRequired({ userId, guildId, amount }, ['userId', 'guildId', 'amount']);
        if (amount <= 0) throw new Error('Amount must be positive');

        try {
            const result = await this.economyModel.deposit(userId, guildId, amount);
            if (!result.success) return result;

            const newBalance = await this.getBalance(userId, guildId);
            return {
                success: true,
                amount,
                walletBalance: newBalance.wallet,
                bankBalance: newBalance.bank,
                totalBalance: newBalance.total
            };
        } catch (error) {
            throw this.handleError(error, 'deposit', { userId, guildId, amount });
        }
    }

    /**
     * Withdraw
     * @param {string} userId
     * @param {string} guildId
     * @param {number} amount
     * @returns {Promise<Object>}
     */
    async withdraw(userId, guildId, amount) {
        this.validateRequired({ userId, guildId, amount }, ['userId', 'guildId', 'amount']);
        if (amount <= 0) throw new Error('Amount must be positive');

        try {
            const result = await this.economyModel.withdraw(userId, guildId, amount);
            if (!result.success) return result;

            const newBalance = await this.getBalance(userId, guildId);
            return {
                success: true,
                amount,
                walletBalance: newBalance.wallet,
                bankBalance: newBalance.bank,
                totalBalance: newBalance.total
            };
        } catch (error) {
            throw this.handleError(error, 'withdraw', { userId, guildId, amount });
        }
    }

    /**
     * Get transactions for a user
     * @param {string} userId
     * @param {string} guildId
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getTransactions(userId, guildId, limit = 10) {
        return this.getTransactionHistory(guildId, userId, limit);
    }
}

module.exports = EconomyService;
