/**
 * Economy Enhancement Service
 *
 * Adds advanced economy features: trading, shop enhancements, cooldowns, and validation.
 */

const logger = require('../helpers/logger_helper');
const { DatabaseError, ValidationError } = require('../core/Errors');

class EconomyEnhancementService {
    constructor(client) {
        this.client = client;
        this.database = client.database;
    }

    /**
     * Validate and execute a trade between users
     */
    async execute_trade(guild_id, from_user, to_user, amount) {
        try {
            if (amount <= 0) {
                throw new ValidationError('Amount must be greater than zero');
            }

            await this.database.transaction(async () => {
                const from_account = await this.database.queryOne(
                    'SELECT wallet_balance FROM economy_accounts WHERE guild_id = ? AND user_id = ?',
                    [guild_id, from_user]
                );

                if (!from_account || from_account.wallet_balance < amount) {
                    throw new ValidationError('Insufficient balance');
                }

                await this.database.query(
                    'UPDATE economy_accounts SET wallet_balance = wallet_balance - ? WHERE guild_id = ? AND user_id = ?',
                    [amount, guild_id, from_user]
                );

                await this.database.query(
                    'UPDATE economy_accounts SET wallet_balance = wallet_balance + ? WHERE guild_id = ? AND user_id = ?',
                    [amount, guild_id, to_user]
                );
            });

            logger.info('Trade executed', { guild_id, from_user, to_user, amount });
            return { success: true };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            logger.error('Failed to execute trade', { error: error.message });
            throw new DatabaseError('Failed to execute trade', { originalError: error.message });
        }
    }

    /**
     * Enforce economy cooldowns (e.g., daily/weekly/work)
     */
    async enforce_cooldown(guild_id, user_id, type, cooldown_ms) {
        const key = `cooldown:${guild_id}:${user_id}:${type}`;
        const now = Date.now();

        const existing = await this.database.queryOne(
            'SELECT expires_at FROM economy_cooldowns WHERE cooldown_key = ?',
            [key]
        );

        if (existing && existing.expires_at > now) {
            const remaining = Math.ceil((existing.expires_at - now) / 1000);
            throw new ValidationError(`Please wait ${remaining}s before using this again.`);
        }

        const expires_at = now + cooldown_ms;
        await this.database.query(
            `INSERT INTO economy_cooldowns (cooldown_key, expires_at)
             VALUES (?, ?)
             ON CONFLICT(cooldown_key) DO UPDATE SET expires_at = excluded.expires_at`,
            [key, expires_at]
        );
    }

    /**
     * Enhanced shop purchase validation
     */
    async validate_purchase(guild_id, user_id, item_cost, tax_rate = 0) {
        const account = await this.database.queryOne(
            'SELECT wallet_balance FROM economy_accounts WHERE guild_id = ? AND user_id = ?',
            [guild_id, user_id]
        );

        if (!account || account.wallet_balance < item_cost) {
            throw new ValidationError('Insufficient balance for purchase');
        }

        const total_cost = Math.ceil(item_cost * (1 + tax_rate));
        return { total_cost };
    }
}

module.exports = EconomyEnhancementService;
