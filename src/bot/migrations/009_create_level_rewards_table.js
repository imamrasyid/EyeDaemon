/**
 * Migration: Create level_rewards table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create level_rewards table
    await db.query(`
        CREATE TABLE level_rewards (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            level INTEGER NOT NULL,
            reward_type TEXT NOT NULL,
            reward_data JSON NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            UNIQUE(guild_id, level, reward_type)
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_level_rewards_guild_id ON level_rewards(guild_id)');
    await db.query('CREATE INDEX idx_level_rewards_level ON level_rewards(guild_id, level)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS level_rewards');
}

module.exports = { up, down };
