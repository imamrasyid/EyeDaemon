/**
 * Migration: Create economy_transactions table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create economy_transactions table
    await db.query(`
        CREATE TABLE economy_transactions (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            from_user_id TEXT,
            to_user_id TEXT,
            amount INTEGER NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            metadata JSON DEFAULT '{}',
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (from_user_id) REFERENCES user_profiles(user_id) ON DELETE SET NULL,
            FOREIGN KEY (to_user_id) REFERENCES user_profiles(user_id) ON DELETE SET NULL
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_economy_transactions_guild_id ON economy_transactions(guild_id)');
    await db.query('CREATE INDEX idx_economy_transactions_from_user ON economy_transactions(from_user_id)');
    await db.query('CREATE INDEX idx_economy_transactions_to_user ON economy_transactions(to_user_id)');
    await db.query('CREATE INDEX idx_economy_transactions_type ON economy_transactions(guild_id, type)');
    await db.query('CREATE INDEX idx_economy_transactions_created_at ON economy_transactions(created_at DESC)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS economy_transactions');
}

module.exports = { up, down };
