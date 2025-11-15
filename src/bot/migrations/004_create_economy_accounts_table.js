/**
 * Migration: Create economy_accounts table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create economy_accounts table
    await db.query(`
        CREATE TABLE economy_accounts (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            wallet_balance INTEGER DEFAULT 0,
            bank_balance INTEGER DEFAULT 0,
            total_earned INTEGER DEFAULT 0,
            total_spent INTEGER DEFAULT 0,
            daily_streak INTEGER DEFAULT 0,
            last_daily_at INTEGER,
            last_work_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
            UNIQUE(guild_id, user_id)
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_economy_accounts_guild_id ON economy_accounts(guild_id)');
    await db.query('CREATE INDEX idx_economy_accounts_user_id ON economy_accounts(user_id)');
    await db.query('CREATE INDEX idx_economy_accounts_wallet ON economy_accounts(guild_id, wallet_balance DESC)');
    await db.query('CREATE INDEX idx_economy_accounts_total ON economy_accounts(guild_id, total_earned DESC)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS economy_accounts');
}

module.exports = { up, down };
