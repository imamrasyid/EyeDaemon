/**
 * Migration: Create event_logs table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create event_logs table
    await db.query(`
        CREATE TABLE event_logs (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            user_id TEXT,
            channel_id TEXT,
            event_data JSON NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE SET NULL
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_event_logs_guild_id ON event_logs(guild_id)');
    await db.query('CREATE INDEX idx_event_logs_type ON event_logs(guild_id, event_type)');
    await db.query('CREATE INDEX idx_event_logs_user_id ON event_logs(user_id)');
    await db.query('CREATE INDEX idx_event_logs_created_at ON event_logs(created_at DESC)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS event_logs');
}

module.exports = { up, down };
