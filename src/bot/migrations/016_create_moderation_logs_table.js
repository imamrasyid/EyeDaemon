/**
 * Migration: Create moderation_logs table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create moderation_logs table
    await db.query(`
        CREATE TABLE moderation_logs (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            action TEXT NOT NULL,
            target_user_id TEXT NOT NULL,
            moderator_id TEXT NOT NULL,
            reason TEXT,
            duration INTEGER,
            metadata JSON DEFAULT '{}',
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (target_user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
            FOREIGN KEY (moderator_id) REFERENCES user_profiles(user_id) ON DELETE SET NULL
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_moderation_logs_guild_id ON moderation_logs(guild_id)');
    await db.query('CREATE INDEX idx_moderation_logs_target ON moderation_logs(target_user_id)');
    await db.query('CREATE INDEX idx_moderation_logs_moderator ON moderation_logs(moderator_id)');
    await db.query('CREATE INDEX idx_moderation_logs_action ON moderation_logs(guild_id, action)');
    await db.query('CREATE INDEX idx_moderation_logs_created_at ON moderation_logs(created_at DESC)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS moderation_logs');
}

module.exports = { up, down };
