/**
 * Migration: Create guild_members table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create guild_members table
    await db.query(`
        CREATE TABLE guild_members (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            nickname TEXT,
            roles JSON DEFAULT '[]',
            joined_at INTEGER NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            last_seen_at INTEGER,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
            UNIQUE(guild_id, user_id)
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_guild_members_guild_id ON guild_members(guild_id)');
    await db.query('CREATE INDEX idx_guild_members_user_id ON guild_members(user_id)');
    await db.query('CREATE INDEX idx_guild_members_active ON guild_members(guild_id, is_active)');
    await db.query('CREATE INDEX idx_guild_members_last_seen ON guild_members(last_seen_at)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS guild_members');
}

module.exports = { up, down };
