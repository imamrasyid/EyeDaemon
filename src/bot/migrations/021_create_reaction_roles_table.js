/**
 * Migration: Create reaction_roles table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create reaction_roles table
    await db.query(`
        CREATE TABLE reaction_roles (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            emoji TEXT NOT NULL,
            role_id TEXT NOT NULL,
            description TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            UNIQUE(message_id, emoji)
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_reaction_roles_guild_id ON reaction_roles(guild_id)');
    await db.query('CREATE INDEX idx_reaction_roles_message_id ON reaction_roles(message_id)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS reaction_roles');
}

module.exports = { up, down };
