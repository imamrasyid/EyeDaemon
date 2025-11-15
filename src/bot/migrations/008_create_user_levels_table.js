/**
 * Migration: Create user_levels table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create user_levels table
    await db.query(`
        CREATE TABLE user_levels (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            total_messages INTEGER DEFAULT 0,
            voice_minutes INTEGER DEFAULT 0,
            last_xp_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
            UNIQUE(guild_id, user_id)
        )
    `);

    // Create indexes for leaderboard queries
    await db.query('CREATE INDEX idx_user_levels_guild_id ON user_levels(guild_id)');
    await db.query('CREATE INDEX idx_user_levels_xp ON user_levels(guild_id, xp DESC)');
    await db.query('CREATE INDEX idx_user_levels_level ON user_levels(guild_id, level DESC)');
    await db.query('CREATE INDEX idx_user_levels_messages ON user_levels(guild_id, total_messages DESC)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS user_levels');
}

module.exports = { up, down };
