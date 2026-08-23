'use strict';

/**
 * EconomyModel
 * 
 * Manages economy data: economy_accounts, economy_transactions, economy_cooldowns.
 * Synchronized with consolidated schema.
 */

const Model = require('../../system/core/Model');

class EconomyModel extends Model {
    constructor(instance) {
        super(instance);
        this.tableName = 'economy_accounts';
    }

    /**
     * Get user balance
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<Object>}
     */
    async getUserBalance(userId, guildId) {
        try {
            const rows = await this.query(
                `SELECT balance, bank_balance, last_daily, last_weekly, created_at, updated_at
                 FROM economy_accounts
                 WHERE user_id = ? AND guild_id = ?`,
                [userId, guildId]
            );

            if (rows && rows.length > 0) {
                const row = rows[0];
                return {
                    balance: row.balance || 0,
                    bank_balance: row.bank_balance || 0,
                    total: (row.balance || 0) + (row.bank_balance || 0),
                    last_daily: row.last_daily,
                    last_weekly: row.last_weekly,
                };
            }

            // Default starting balance if not created yet
            const defaultStarting = 1000;
            return {
                balance: defaultStarting,
                bank_balance: 0,
                total: defaultStarting,
                last_daily: null,
                last_weekly: null,
            };
        } catch (error) {
            this.log(`Error getting balance for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Update user balance atomically
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} amount - Amount to add (negative to subtract)
     * @param {string} type - 'balance' (wallet) or 'bank_balance' (bank)
     * @param {string} transactionType - Transaction type for logging
     * @param {string} reason - Transaction reason
     * @returns {Promise<boolean>}
     */
    async updateBalance(userId, guildId, amount, type = 'balance', transactionType = 'adjustment', reason = null) {
        try {
            await this._ensureAccount(userId, guildId);

            const column = type === 'bank_balance' || type === 'bank' ? 'bank_balance' : 'balance';
            const now = Math.floor(Date.now() / 1000);

            // Read current balance before
            const beforeRows = await this.query(
                `SELECT balance, bank_balance FROM economy_accounts WHERE user_id = ? AND guild_id = ?`,
                [userId, guildId]
            );
            const currentBalance = beforeRows?.[0]?.[column] || 0;
            const newBalance = currentBalance + amount;

            await this.query(
                `UPDATE economy_accounts 
                 SET ${column} = ${column} + ?, 
                     updated_at = ? 
                 WHERE user_id = ? AND guild_id = ?`,
                [amount, now, userId, guildId]
            );

            // Log transaction
            if (amount !== 0) {
                await this._logTransaction(userId, guildId, transactionType, amount, currentBalance, newBalance, reason);
            }

            return true;
        } catch (error) {
            this.log(`Error updating balance for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Claim daily reward
     * @param {string} userId
     * @param {string} guildId
     * @returns {Promise<Object>}
     */
    async claimDaily(userId, guildId) {
        try {
            await this._ensureAccount(userId, guildId);

            const now = Math.floor(Date.now() / 1000);
            const oneDaySeconds = 24 * 60 * 60;

            const account = (await this.query(
                `SELECT balance, last_daily FROM economy_accounts WHERE user_id = ? AND guild_id = ?`,
                [userId, guildId]
            ))?.[0];

            const lastDaily = account?.last_daily || 0;
            const timeSince = now - lastDaily;

            if (timeSince < oneDaySeconds) {
                return { success: false, timeLeft: (oneDaySeconds - timeSince) * 1000 };
            }

            const reward = 500;
            const currentBal = account?.balance || 0;
            const newBal = currentBal + reward;

            const updateRes = await this.query(
                `UPDATE economy_accounts
                 SET balance = balance + ?,
                     last_daily = ?,
                     updated_at = ?
                 WHERE user_id = ? AND guild_id = ?
                   AND (last_daily IS NULL OR last_daily = ?)`,
                [reward, now, now, userId, guildId, lastDaily]
            );

            if (!updateRes || updateRes.changes === 0) {
                const fresh = (await this.query(
                    `SELECT last_daily FROM economy_accounts WHERE user_id = ? AND guild_id = ?`,
                    [userId, guildId]
                ))?.[0];
                return { success: false, timeLeft: (oneDaySeconds - (now - (fresh?.last_daily || 0))) * 1000 };
            }

            await this._logTransaction(userId, guildId, 'daily', reward, currentBal, newBal, 'Daily reward');

            return {
                success: true,
                amount: reward,
                streak: 1,
                newBalance: newBal,
            };
        } catch (error) {
            this.log(`Error claiming daily for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Work to earn money
     * @param {string} userId
     * @param {string} guildId
     * @returns {Promise<Object>}
     */
    async work(userId, guildId) {
        try {
            await this._ensureAccount(userId, guildId);

            const now = Math.floor(Date.now() / 1000);
            const cooldownSeconds = 60 * 60; // 1 hour

            const cdRows = await this.query(
                `SELECT expires_at FROM economy_cooldowns WHERE user_id = ? AND guild_id = ? AND action = 'work'`,
                [userId, guildId]
            );

            const expiresAt = cdRows?.[0]?.expires_at || 0;
            if (expiresAt > now) {
                return { success: false, timeLeft: (expiresAt - now) * 1000 };
            }

            const amount = Math.floor(Math.random() * 200) + 100;
            const messages = [
                'You worked as a developer and fixed some bugs!',
                'You delivered packages around town!',
                'You helped at a local restaurant!',
                'You did some freelance design work!',
                'You walked dogs in the neighborhood!'
            ];
            const message = messages[Math.floor(Math.random() * messages.length)];

            const newExpires = now + cooldownSeconds;
            await this.query(
                `INSERT INTO economy_cooldowns (user_id, guild_id, action, expires_at)
                 VALUES (?, ?, 'work', ?)
                 ON CONFLICT(user_id, guild_id, action) DO UPDATE SET expires_at = excluded.expires_at`,
                [userId, guildId, newExpires]
            );

            const account = (await this.query(
                `SELECT balance FROM economy_accounts WHERE user_id = ? AND guild_id = ?`,
                [userId, guildId]
            ))?.[0];
            const currentBal = account?.balance || 0;
            const newBal = currentBal + amount;

            await this.query(
                `UPDATE economy_accounts SET balance = balance + ?, updated_at = ? WHERE user_id = ? AND guild_id = ?`,
                [amount, now, userId, guildId]
            );

            await this._logTransaction(userId, guildId, 'work', amount, currentBal, newBal, message);

            return {
                success: true,
                amount,
                message,
                newBalance: newBal,
            };
        } catch (error) {
            this.log(`Error working for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Transfer money between users
     * @param {string} fromUserId
     * @param {string} toUserId
     * @param {string} guildId
     * @param {number} amount
     * @returns {Promise<Object>}
     */
    async transfer(fromUserId, toUserId, guildId, amount) {
        try {
            await this._ensureAccount(fromUserId, guildId);
            await this._ensureAccount(toUserId, guildId);

            const now = Math.floor(Date.now() / 1000);
            let fromNewBal = 0;

            await this.db.transaction(async (tx) => {
                const senderRows = await tx.query(
                    `SELECT balance FROM economy_accounts WHERE user_id = ? AND guild_id = ?`,
                    [fromUserId, guildId]
                );
                const senderBal = senderRows?.[0]?.balance ?? 0;

                if (senderBal < amount) {
                    const err = new Error('INSUFFICIENT_BALANCE');
                    err.code = 'INSUFFICIENT_BALANCE';
                    throw err;
                }

                // Deduct from sender
                await tx.query(
                    `UPDATE economy_accounts SET balance = balance - ?, updated_at = ? WHERE user_id = ? AND guild_id = ?`,
                    [amount, now, fromUserId, guildId]
                );

                // Add to receiver
                await tx.query(
                    `UPDATE economy_accounts SET balance = balance + ?, updated_at = ? WHERE user_id = ? AND guild_id = ?`,
                    [amount, now, toUserId, guildId]
                );

                fromNewBal = senderBal - amount;

                // Log transactions
                await tx.query(
                    `INSERT INTO economy_transactions (user_id, guild_id, type, amount, balance_before, balance_after, reason, created_at)
                     VALUES (?, ?, 'transfer_out', ?, ?, ?, ?, ?)`,
                    [fromUserId, guildId, -amount, senderBal, fromNewBal, `Transfer to ${toUserId}`, now]
                );
            });

            return { success: true, newBalance: fromNewBal };
        } catch (error) {
            if (error.code === 'INSUFFICIENT_BALANCE') {
                return { success: false, message: 'Insufficient balance' };
            }
            this.log(`Error transferring money: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Deposit wallet coins to bank
     * @param {string} userId
     * @param {string} guildId
     * @param {number} amount
     * @returns {Promise<Object>}
     */
    async deposit(userId, guildId, amount) {
        try {
            await this._ensureAccount(userId, guildId);
            const now = Math.floor(Date.now() / 1000);

            const result = await this.query(
                `UPDATE economy_accounts
                 SET balance = balance - ?,
                     bank_balance = bank_balance + ?,
                     updated_at = ?
                 WHERE user_id = ? AND guild_id = ? AND balance >= ?`,
                [amount, amount, now, userId, guildId, amount]
            );

            if (!result || result.changes === 0) {
                return { success: false, message: 'Insufficient wallet balance' };
            }

            return { success: true };
        } catch (error) {
            this.log(`Error depositing for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Withdraw bank coins to wallet
     * @param {string} userId
     * @param {string} guildId
     * @param {number} amount
     * @returns {Promise<Object>}
     */
    async withdraw(userId, guildId, amount) {
        try {
            await this._ensureAccount(userId, guildId);
            const now = Math.floor(Date.now() / 1000);

            const result = await this.query(
                `UPDATE economy_accounts
                 SET balance = balance + ?,
                     bank_balance = bank_balance - ?,
                     updated_at = ?
                 WHERE user_id = ? AND guild_id = ? AND bank_balance >= ?`,
                [amount, amount, now, userId, guildId, amount]
            );

            if (!result || result.changes === 0) {
                return { success: false, message: 'Insufficient bank balance' };
            }

            return { success: true };
        } catch (error) {
            this.log(`Error withdrawing for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get economy leaderboard
     * @param {string} guildId
     * @param {string} type
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getLeaderboard(guildId, type = 'wallet', limit = 10) {
        try {
            let orderBy = 'balance DESC';
            if (type === 'bank') orderBy = 'bank_balance DESC';
            if (type === 'total') orderBy = '(balance + bank_balance) DESC';

            const rows = await this.query(
                `SELECT user_id, balance, bank_balance
                 FROM economy_accounts
                 WHERE guild_id = ?
                 ORDER BY ${orderBy}
                 LIMIT ?`,
                [guildId, limit]
            );

            return rows.map((row, index) => ({
                rank: index + 1,
                userId: row.user_id,
                walletBalance: row.balance,
                bankBalance: row.bank_balance,
                totalBalance: row.balance + row.bank_balance,
            }));
        } catch (error) {
            this.log(`Error getting leaderboard: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get transaction history
     * @param {string} guildId
     * @param {string} userId
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getTransactionHistory(guildId, userId = null, limit = 50) {
        try {
            let sql = `SELECT * FROM economy_transactions WHERE guild_id = ?`;
            const params = [guildId];

            if (userId) {
                sql += ` AND user_id = ?`;
                params.push(userId);
            }

            sql += ` ORDER BY created_at DESC LIMIT ?`;
            params.push(limit);

            const rows = await this.query(sql, params);
            return rows || [];
        } catch (error) {
            this.log(`Error getting transaction history: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Ensure user and economy account exist
     * @private
     */
    async _ensureAccount(userId, guildId) {
        const now = Math.floor(Date.now() / 1000);
        const startingBalance = 1000;

        // Ensure user profile exists for FK
        await this.query(
            `INSERT INTO user_profiles (user_id, created_at, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(user_id) DO NOTHING`,
            [userId, now, now]
        );

        // Ensure economy account exists
        await this.query(
            `INSERT INTO economy_accounts (user_id, guild_id, balance, bank_balance, created_at, updated_at)
             VALUES (?, ?, ?, 0, ?, ?)
             ON CONFLICT(user_id, guild_id) DO NOTHING`,
            [userId, guildId, startingBalance, now, now]
        );
    }

    /**
     * Log transaction
     * @private
     */
    async _logTransaction(userId, guildId, type, amount, before, after, reason = null) {
        try {
            const now = Math.floor(Date.now() / 1000);
            await this.query(
                `INSERT INTO economy_transactions (user_id, guild_id, type, amount, balance_before, balance_after, reason, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, guildId, type, amount, before, after, reason, now]
            );
        } catch (err) {
            this.log(`Failed to log transaction: ${err.message}`, 'warn');
        }
    }
}

module.exports = EconomyModel;
