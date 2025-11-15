/**
 * Migration: Create user_warnings table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create user_warnings table
    await db.query(`
        CREATE TABLE user_warnings (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            moderator_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            expires_at INTEGER,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
            FOREIGN KEY (moderator_id) REFERENCES user_profiles(user_id) ON DELETE SET NULL
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_user_warnings_guild_user ON user_warnings(guild_id, user_id)');
    await db.query('CREATE INDEX idx_user_warnings_active ON user_warnings(guild_id, is_active)');
    await db.query('CREATE INDEX idx_user_warnings_created_at ON user_warnings(created_at DESC)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS user_warnings');
}

module.exports = { up, down };
