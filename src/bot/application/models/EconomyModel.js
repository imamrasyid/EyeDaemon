/**
 * EconomyModel
 * 
 * Model for managing economy data including balance, transactions, and shop.
 * Updated for new Turso DB schema with separate tables for accounts, transactions, shop items, and inventories.
 */

const Model = require('../../system/core/Model');
const { v4: uuidv4 } = require('uuid');

class EconomyModel extends Model {
    /**
     * Create a new EconomyModel instance
     * @param {Object} instance - The parent instance
     */
    constructor(instance) {
        super(instance);
        this.tableName = 'economy_accounts';
    }

    /**
     * Get user balance
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<Object>} Balance information
     */
    async getUserBalance(userId, guildId) {
        try {
            const account = await this.findOneBy({
                guild_id: guildId,
                user_id: userId
            });

            if (account) {
                return {
                    balance: account.wallet_balance || 0,
                    bank_balance: account.bank_balance || 0,
                    total_earned: account.total_earned || 0,
                    total_spent: account.total_spent || 0
                };
            }

            // Get starting balance from guild settings for default
            let startingBalance = 1000; // Default

            try {
                if (this.instance.client && this.instance.client.modules) {
                    const adminModule = this.instance.client.modules.get('admin');
                    if (adminModule) {
                        const guildConfigService = adminModule.getService('GuildConfigService');
                        if (guildConfigService) {
                            const configuredBalance = await guildConfigService.getSetting(guildId, 'economy_starting_balance');
                            if (configuredBalance !== undefined && configuredBalance !== null) {
                                startingBalance = configuredBalance;
                            }
                        }
                    }
                }
            } catch (error) {
                this.log(`Error getting starting balance from config: ${error.message}`, 'warn');
            }

            // Return default balance if not found
            return {
                balance: startingBalance,
                bank_balance: 0,
                total_earned: 0,
                total_spent: 0
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
     * @param {string} type - Balance type ('wallet' or 'bank')
     * @param {string} transactionType - Transaction type for logging
     * @param {string} description - Transaction description
     * @returns {Promise<boolean>} Success status
     */
    async updateBalance(userId, guildId, amount, type = 'wallet', transactionType = 'adjustment', description = null) {
        try {
            // Ensure account exists
            await this._ensureAccount(userId, guildId);

            const column = type === 'wallet' ? 'wallet_balance' : 'bank_balance';
            const now = Math.floor(Date.now() / 1000);

            // Atomic balance update
            const result = await this.query(
                `UPDATE ${this.tableName} 
                 SET ${column} = ${column} + ?, 
                     total_earned = total_earned + CASE WHEN ? > 0 THEN ? ELSE 0 END,
                     total_spent = total_spent + CASE WHEN ? < 0 THEN ABS(?) ELSE 0 END,
                     updated_at = ? 
                 WHERE guild_id = ? AND user_id = ?`,
                [amount, amount, amount, amount, amount, now, guildId, userId]
            );

            // Log transaction
            if (amount !== 0) {
                await this._logTransaction(guildId, userId, null, amount, transactionType, description);
            }

            this.log(`Updated ${type} balance for user ${userId} by ${amount}`, 'info');
            return true;
        } catch (error) {
            this.log(`Error updating balance for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Claim daily reward
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<Object>} Result with success status and details
     */
    async claimDaily(userId, guildId) {
        try {
            await this._ensureAccount(userId, guildId);

            const account = await this.findOneBy({
                guild_id: guildId,
                user_id: userId
            });

            const now = Math.floor(Date.now() / 1000);
            const lastDaily = account.last_daily_at || 0;
            const streak = account.daily_streak || 0;
            const timeSinceLastDaily = now - lastDaily;
            const oneDaySeconds = 24 * 60 * 60;

            // Check if already claimed today
            if (timeSinceLastDaily < oneDaySeconds) {
                return {
                    success: false,
                    timeLeft: oneDaySeconds - timeSinceLastDaily
                };
            }

            // Calculate new streak
            const newStreak = timeSinceLastDaily < 2 * oneDaySeconds ? streak + 1 : 1;

            // Calculate reward (base + streak bonus)
            const baseReward = 500;
            const streakBonus = Math.min(newStreak * 50, 500);
            const totalReward = baseReward + streakBonus;

            // Update account
            await this.updateBy(
                { guild_id: guildId, user_id: userId },
                {
                    wallet_balance: (account.wallet_balance || 0) + totalReward,
                    total_earned: (account.total_earned || 0) + totalReward,
                    last_daily_at: now,
                    daily_streak: newStreak,
                    updated_at: now
                }
            );

            // Log transaction
            await this._logTransaction(guildId, null, userId, totalReward, 'daily', `Daily reward (streak: ${newStreak})`);

            const newBalance = await this.getUserBalance(userId, guildId);

            return {
                success: true,
                amount: totalReward,
                streak: newStreak,
                newBalance: newBalance.balance
            };
        } catch (error) {
            this.log(`Error claiming daily for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Work to earn money
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<Object>} Result with success status and details
     */
    async work(userId, guildId) {
        try {
            await this._ensureAccount(userId, guildId);

            const account = await this.findOneBy({
                guild_id: guildId,
                user_id: userId
            });

            const now = Math.floor(Date.now() / 1000);
            const lastWork = account.last_work_at || 0;
            const timeSinceLastWork = now - lastWork;
            const cooldownSeconds = 60 * 60; // 1 hour

            // Check cooldown
            if (timeSinceLastWork < cooldownSeconds) {
                return {
                    success: false,
                    timeLeft: cooldownSeconds - timeSinceLastWork
                };
            }

            // Random work amount
            const amount = Math.floor(Math.random() * 200) + 100; // 100-300 coins

            // Work messages
            const messages = [
                'You worked as a developer and fixed some bugs!',
                'You delivered packages around town!',
                'You helped at a local restaurant!',
                'You did some freelance work!',
                'You walked dogs in the neighborhood!'
            ];
            const message = messages[Math.floor(Math.random() * messages.length)];

            // Update account
            await this.updateBy(
                { guild_id: guildId, user_id: userId },
                {
                    wallet_balance: (account.wallet_balance || 0) + amount,
                    total_earned: (account.total_earned || 0) + amount,
                    last_work_at: now,
                    updated_at: now
                }
            );

            // Log transaction
            await this._logTransaction(guildId, null, userId, amount, 'work', message);

            const newBalance = await this.getUserBalance(userId, guildId);

            return {
                success: true,
                amount,
                message,
                newBalance: newBalance.balance
            };
        } catch (error) {
            this.log(`Error working for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Transfer money to another user
     * @param {string} fromUserId - Sender user ID
     * @param {string} toUserId - Receiver user ID
     * @param {string} guildId - Guild ID
     * @param {number} amount - Amount to transfer
     * @returns {Promise<Object>} Result with success status
     */
    async transfer(fromUserId, toUserId, guildId, amount) {
        try {
            // Get sender balance
            const senderBalance = await this.getUserBalance(fromUserId, guildId);

            if (senderBalance.balance < amount) {
                return {
                    success: false,
                    message: 'Insufficient balance'
                };
            }

            // Ensure both accounts exist
            await this._ensureAccount(fromUserId, guildId);
            await this._ensureAccount(toUserId, guildId);

            const now = Math.floor(Date.now() / 1000);

            // Use transaction for atomicity
            await this.db.transaction(async (db) => {
                // Deduct from sender
                await db.query(
                    `UPDATE ${this.tableName} 
                     SET wallet_balance = wallet_balance - ?, 
                         total_spent = total_spent + ?,
                         updated_at = ? 
                     WHERE guild_id = ? AND user_id = ?`,
                    [amount, amount, now, guildId, fromUserId]
                );

                // Add to receiver
                await db.query(
                    `UPDATE ${this.tableName} 
                     SET wallet_balance = wallet_balance + ?, 
                         total_earned = total_earned + ?,
                         updated_at = ? 
                     WHERE guild_id = ? AND user_id = ?`,
                    [amount, amount, now, guildId, toUserId]
                );

                // Log transaction
                await this._logTransaction(guildId, fromUserId, toUserId, amount, 'transfer', `Transfer from ${fromUserId} to ${toUserId}`);
            });

            const newBalance = await this.getUserBalance(fromUserId, guildId);

            this.log(`Transferred ${amount} from ${fromUserId} to ${toUserId}`, 'info');

            return {
                success: true,
                newBalance: newBalance.balance
            };
        } catch (error) {
            this.log(`Error transferring money: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Deposit money to bank
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} amount - Amount to deposit
     * @returns {Promise<Object>} Result with success status
     */
    async deposit(userId, guildId, amount) {
        try {
            const balance = await this.getUserBalance(userId, guildId);

            if (balance.balance < amount) {
                return {
                    success: false,
                    message: 'Insufficient balance in wallet'
                };
            }

            await this._ensureAccount(userId, guildId);

            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `UPDATE ${this.tableName} 
                 SET wallet_balance = wallet_balance - ?, 
                     bank_balance = bank_balance + ?,
                     updated_at = ? 
                 WHERE guild_id = ? AND user_id = ?`,
                [amount, amount, now, guildId, userId]
            );

            return { success: true };
        } catch (error) {
            this.log(`Error depositing for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Withdraw money from bank
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} amount - Amount to withdraw
     * @returns {Promise<Object>} Result with success status
     */
    async withdraw(userId, guildId, amount) {
        try {
            const balance = await this.getUserBalance(userId, guildId);

            if (balance.bank_balance < amount) {
                return {
                    success: false,
                    message: 'Insufficient balance in bank'
                };
            }

            await this._ensureAccount(userId, guildId);

            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `UPDATE ${this.tableName} 
                 SET wallet_balance = wallet_balance + ?, 
                     bank_balance = bank_balance - ?,
                     updated_at = ? 
                 WHERE guild_id = ? AND user_id = ?`,
                [amount, amount, now, guildId, userId]
            );

            return { success: true };
        } catch (error) {
            this.log(`Error withdrawing for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get economy leaderboard
     * @param {string} guildId - Guild ID
     * @param {string} type - Leaderboard type ('wallet', 'bank', 'total')
     * @param {number} limit - Number of users to return
     * @returns {Promise<Array>} Leaderboard data
     */
    async getLeaderboard(guildId, type = 'wallet', limit = 10) {
        try {
            let orderBy = 'wallet_balance DESC';
            switch (type) {
                case 'bank':
                    orderBy = 'bank_balance DESC';
                    break;
                case 'total':
                    orderBy = '(wallet_balance + bank_balance) DESC';
                    break;
                default:
                    orderBy = 'wallet_balance DESC';
            }

            const results = await this.query(
                `SELECT user_id, wallet_balance, bank_balance, total_earned, total_spent 
                 FROM ${this.tableName} 
                 WHERE guild_id = ? 
                 ORDER BY ${orderBy} 
                 LIMIT ?`,
                [guildId, limit]
            );

            return results.map((row, index) => ({
                rank: index + 1,
                userId: row.user_id,
                walletBalance: row.wallet_balance,
                bankBalance: row.bank_balance,
                totalBalance: row.wallet_balance + row.bank_balance,
                totalEarned: row.total_earned,
                totalSpent: row.total_spent
            }));
        } catch (error) {
            this.log(`Error getting leaderboard: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get transaction history
     * @param {string} guildId - Guild ID
     * @param {string} userId - User ID (optional)
     * @param {number} limit - Number of transactions to return
     * @returns {Promise<Array>} Transaction history
     */
    async getTransactionHistory(guildId, userId = null, limit = 50) {
        try {
            let sql = `SELECT * FROM economy_transactions WHERE guild_id = ?`;
            const params = [guildId];

            if (userId) {
                sql += ` AND (from_user_id = ? OR to_user_id = ?)`;
                params.push(userId, userId);
            }

            sql += ` ORDER BY created_at DESC LIMIT ?`;
            params.push(limit);

            const results = await this.query(sql, params);
            return results || [];
        } catch (error) {
            this.log(`Error getting transaction history: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Ensure economy account exists for user
     * @private
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<void>}
     */
    async _ensureAccount(userId, guildId) {
        try {
            const exists = await this.exists({
                guild_id: guildId,
                user_id: userId
            });

            if (exists) {
                return;
            }

            // Get starting balance from guild settings
            let startingBalance = 1000; // Default

            try {
                if (this.instance.client && this.instance.client.modules) {
                    const adminModule = this.instance.client.modules.get('admin');
                    if (adminModule) {
                        const guildConfigService = adminModule.getService('GuildConfigService');
                        if (guildConfigService) {
                            const configuredBalance = await guildConfigService.getSetting(guildId, 'economy_starting_balance');
                            if (configuredBalance !== undefined && configuredBalance !== null) {
                                startingBalance = configuredBalance;
                            }
                        }
                    }
                }
            } catch (error) {
                this.log(`Error getting starting balance from config: ${error.message}`, 'warn');
            }

            const now = Math.floor(Date.now() / 1000);
            const accountId = `${guildId}-${userId}`;

            // Ensure user profile exists to satisfy FK (fallback to minimal profile)
            const profile = await this.query(
                'SELECT user_id FROM user_profiles WHERE user_id = ?',
                [userId]
            );

            if (!profile || profile.length === 0) {
                await this.query(
                    `INSERT INTO user_profiles (user_id, username, discriminator, avatar_url, bot, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(user_id) DO UPDATE SET
                        username = excluded.username,
                        discriminator = excluded.discriminator,
                        avatar_url = excluded.avatar_url,
                        bot = excluded.bot,
                        updated_at = excluded.updated_at`,
                    [
                        userId,
                        String(userId),
                        null,
                        null,
                        0,
                        now,
                        now
                    ]
                );
                this.log(`Inserted fallback user_profile for ${userId}`, 'warn');
            }

            await this.insert({
                id: accountId,
                guild_id: guildId,
                user_id: userId,
                wallet_balance: startingBalance,
                bank_balance: 0,
                total_earned: startingBalance,
                total_spent: 0,
                daily_streak: 0,
                last_daily_at: null,
                last_work_at: null,
                created_at: now,
                updated_at: now
            });

            this.log(`Created economy account for user ${userId} with starting balance ${startingBalance}`, 'info');
        } catch (error) {
            this.log(`Error ensuring account: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Log a transaction
     * @private
     * @param {string} guildId - Guild ID
     * @param {string} fromUserId - From user ID (null for system)
     * @param {string} toUserId - To user ID (null for system)
     * @param {number} amount - Transaction amount
     * @param {string} type - Transaction type
     * @param {string} description - Transaction description
     * @returns {Promise<void>}
     */
    async _logTransaction(guildId, fromUserId, toUserId, amount, type, description) {
        try {
            const transactionId = uuidv4();
            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `INSERT INTO economy_transactions 
                 (id, guild_id, from_user_id, to_user_id, amount, type, description, metadata, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [transactionId, guildId, fromUserId, toUserId, amount, type, description, '{}', now]
            );
        } catch (error) {
            this.log(`Error logging transaction: ${error.message}`, 'warn');
            // Don't throw - transaction logging is not critical
        }
    }
}

module.exports = EconomyModel;
