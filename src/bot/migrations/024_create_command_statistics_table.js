/**
 * Migration: Create command_statistics table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create command_statistics table
    await db.query(`
        CREATE TABLE command_statistics (
            id TEXT PRIMARY KEY,
            guild_id TEXT,
            user_id TEXT,
            command_name TEXT NOT NULL,
            execution_time INTEGER NOT NULL,
            success BOOLEAN DEFAULT TRUE,
            error_message TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE SET NULL
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_command_statistics_guild_id ON command_statistics(guild_id)');
    await db.query('CREATE INDEX idx_command_statistics_user_id ON command_statistics(user_id)');
    await db.query('CREATE INDEX idx_command_statistics_command ON command_statistics(command_name)');
    await db.query('CREATE INDEX idx_command_statistics_created_at ON command_statistics(created_at DESC)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS command_statistics');
}

module.exports = { up, down };
