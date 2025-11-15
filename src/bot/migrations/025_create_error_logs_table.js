/**
 * Migration: Create error_logs table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create error_logs table
    await db.query(`
        CREATE TABLE error_logs (
            id TEXT PRIMARY KEY,
            error_type TEXT NOT NULL,
            error_message TEXT NOT NULL,
            stack_trace TEXT,
            context JSON DEFAULT '{}',
            guild_id TEXT,
            user_id TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE SET NULL,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE SET NULL
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_error_logs_type ON error_logs(error_type)');
    await db.query('CREATE INDEX idx_error_logs_guild_id ON error_logs(guild_id)');
    await db.query('CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS error_logs');
}

module.exports = { up, down };
