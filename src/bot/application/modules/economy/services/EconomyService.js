/**
 * EconomyService
 * 
 * Business logic for economy operations including balance management,
 * transfers, deposits, withdrawals, and transaction logging.
 */

const BaseService = require('../../../../system/core/BaseService');

class EconomyService extends BaseService {
    /**
     * Create a new EconomyService instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Service configuration options
     */
    constructor(client, options = {}) {
        super(client, options);
        this.economyModel = null;
    }

    /**
     * Initialize service
     * @returns {Promise<void>}
     */
    async initialize() {
        await super.initialize();

        // Load economy model
        const loader = this.client.loader;
        if (loader) {
            this.economyModel = loader.model('EconomyModel');
        }

        this.log('EconomyService initialized', 'info');
    }

    /**
     * Get user balance
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<Object>} Balance object with wallet and bank
     */
    async getBalance(userId, guildId) {
        this.validateRequired({ userId, guildId }, ['userId', 'guildId']);

        try {
            const balance = await this.economyModel.getUserBalance(userId, guildId);

            this.log(`Retrieved balance for user ${userId}`, 'debug');

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
     * Add balance to user's wallet
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} amount - Amount to add
     * @param {string} reason - Reason for adding balance
     * @returns {Promise<Object>} Result with new balance
     */
    async addBalance(userId, guildId, amount, reason = 'Unknown') {
        this.validateRequired({ userId, guildId, amount }, ['userId', 'guildId', 'amount']);

        if (amount <= 0) {
            throw new Error('Amount must be positive');
        }

        try {
            await this.economyModel.updateBalance(userId, guildId, amount, 'balance');

            // Log transaction
            await this.logTransaction(userId, guildId, amount, 'add', reason);

            const newBalance = await this.getBalance(userId, guildId);

            this.log(`Added ${amount} to user ${userId}`, 'info', { reason });

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
     * Remove balance from user's wallet
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} amount - Amount to remove
     * @param {string} reason - Reason for removing balance
     * @returns {Promise<Object>} Result with new balance
     */
    async removeBalance(userId, guildId, amount, reason = 'Unknown') {
        this.validateRequired({ userId, guildId, amount }, ['userId', 'guildId', 'amount']);

        if (amount <= 0) {
            throw new Error('Amount must be positive');
        }

        try {
            // Check if user has sufficient balance
            const currentBalance = await this.getBalance(userId, guildId);

            if (currentBalance.wallet < amount) {
                return {
                    success: false,
                    message: 'Insufficient balance',
                    required: amount,
                    available: currentBalance.wallet
                };
            }

            await this.economyModel.updateBalance(userId, guildId, -amount, 'balance');

            // Log transaction
            await this.logTransaction(userId, guildId, -amount, 'remove', reason);

            const newBalance = await this.getBalance(userId, guildId);

            this.log(`Removed ${amount} from user ${userId}`, 'info', { reason });

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
     * Transfer money from one user to another
     * @param {string} fromUserId - Sender user ID
     * @param {string} toUserId - Receiver user ID
     * @param {string} guildId - Guild ID
     * @param {number} amount - Amount to transfer
     * @returns {Promise<Object>} Result with success status
     */
    async transfer(fromUserId, toUserId, guildId, amount) {
        this.validateRequired(
            { fromUserId, toUserId, guildId, amount },
            ['fromUserId', 'toUserId', 'guildId', 'amount']
        );

        if (amount <= 0) {
            throw new Error('Amount must be positive');
        }

        if (fromUserId === toUserId) {
            return {
                success: false,
                message: 'Cannot transfer to yourself'
            };
        }

        try {
            // Check sender balance
            const senderBalance = await this.getBalance(fromUserId, guildId);

            if (senderBalance.wallet < amount) {
                return {
                    success: false,
                    message: 'Insufficient balance',
                    required: amount,
                    available: senderBalance.wallet
                };
            }

            // Perform transfer
            const result = await this.economyModel.transfer(fromUserId, toUserId, guildId, amount);

            if (!result.success) {
                return result;
            }

            // Log transactions for both users
            await this.logTransaction(fromUserId, guildId, -amount, 'transfer_out', `Transfer to user ${toUserId}`);
            await this.logTransaction(toUserId, guildId, amount, 'transfer_in', `Transfer from user ${fromUserId}`);

            const newBalance = await this.getBalance(fromUserId, guildId);

            this.log(`Transferred ${amount} from ${fromUserId} to ${toUserId}`, 'info');

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
     * Deposit money from wallet to bank
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} amount - Amount to deposit
     * @returns {Promise<Object>} Result with success status
     */
    async deposit(userId, guildId, amount) {
        this.validateRequired({ userId, guildId, amount }, ['userId', 'guildId', 'amount']);

        if (amount <= 0) {
            throw new Error('Amount must be positive');
        }

        try {
            const result = await this.economyModel.deposit(userId, guildId, amount);

            if (!result.success) {
                return result;
            }

            // Log transaction
            await this.logTransaction(userId, guildId, amount, 'deposit', 'Deposit to bank');

            const newBalance = await this.getBalance(userId, guildId);

            this.log(`User ${userId} deposited ${amount}`, 'info');

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
     * Withdraw money from bank to wallet
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} amount - Amount to withdraw
     * @returns {Promise<Object>} Result with success status
     */
    async withdraw(userId, guildId, amount) {
        this.validateRequired({ userId, guildId, amount }, ['userId', 'guildId', 'amount']);

        if (amount <= 0) {
            throw new Error('Amount must be positive');
        }

        try {
            const result = await this.economyModel.withdraw(userId, guildId, amount);

            if (!result.success) {
                return result;
            }

            // Log transaction
            await this.logTransaction(userId, guildId, amount, 'withdraw', 'Withdraw from bank');

            const newBalance = await this.getBalance(userId, guildId);

            this.log(`User ${userId} withdrew ${amount}`, 'info');

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
     * Log a transaction
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} amount - Transaction amount (negative for deductions)
     * @param {string} type - Transaction type
     * @param {string} description - Transaction description
     * @returns {Promise<void>}
     */
    async logTransaction(userId, guildId, amount, type, description) {
        try {
            const db = this.getDatabase();
            if (!db) {
                this.log('Database not available for transaction logging', 'warn');
                return;
            }

            // Get member ID
            const memberResult = await this.query(
                'SELECT id FROM members WHERE user_id = ? AND guild_id = ?',
                [userId, guildId]
            );

            if (!memberResult || memberResult.length === 0) {
                this.log(`Member not found for transaction log: ${userId}`, 'warn');
                return;
            }

            const memberId = memberResult[0].id;

            // Insert transaction log
            await this.query(
                `INSERT INTO economy_transactions 
                (member_id, amount, type, description, created_at) 
                VALUES (?, ?, ?, ?, ?)`,
                [memberId, amount, type, description, Date.now()]
            );

            this.log(`Logged transaction for user ${userId}`, 'debug', { type, amount });
        } catch (error) {
            // Don't throw error for logging failures, just log it
            this.log(`Failed to log transaction: ${error.message}`, 'warn', { userId, type, amount });
        }
    }

    /**
     * Get transaction history for a user
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} limit - Maximum number of transactions to retrieve
     * @returns {Promise<Array>} Array of transactions
     */
    async getTransactions(userId, guildId, limit = 10) {
        this.validateRequired({ userId, guildId }, ['userId', 'guildId']);

        try {
            const db = this.getDatabase();
            if (!db) {
                throw new Error('Database not available');
            }

            // Get member ID
            const memberResult = await this.query(
                'SELECT id FROM members WHERE user_id = ? AND guild_id = ?',
                [userId, guildId]
            );

            if (!memberResult || memberResult.length === 0) {
                return [];
            }

            const memberId = memberResult[0].id;

            // Get transactions
            const transactions = await this.query(
                `SELECT amount, type, description, created_at 
                FROM economy_transactions 
                WHERE member_id = ? 
                ORDER BY created_at DESC 
                LIMIT ?`,
                [memberId, limit]
            );

            this.log(`Retrieved ${transactions.length} transactions for user ${userId}`, 'debug');

            return transactions || [];
        } catch (error) {
            throw this.handleError(error, 'getTransactions', { userId, guildId, limit });
        }
    }
}

module.exports = EconomyService;
