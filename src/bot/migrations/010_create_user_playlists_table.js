/**
 * Migration: Create user_playlists table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create user_playlists table
    await db.query(`
        CREATE TABLE user_playlists (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            is_public BOOLEAN DEFAULT FALSE,
            play_count INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_user_playlists_guild_user ON user_playlists(guild_id, user_id)');
    await db.query('CREATE INDEX idx_user_playlists_public ON user_playlists(guild_id, is_public)');
    await db.query('CREATE INDEX idx_user_playlists_name ON user_playlists(guild_id, name)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS user_playlists');
}

module.exports = { up, down };
