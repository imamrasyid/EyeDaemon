/**
 * Migration: Create ticket_categories table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create ticket_categories table
    await db.query(`
        CREATE TABLE ticket_categories (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            emoji TEXT,
            staff_role_ids JSON DEFAULT '[]',
            auto_response TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            UNIQUE(guild_id, name)
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_ticket_categories_guild_id ON ticket_categories(guild_id)');
    await db.query('CREATE INDEX idx_ticket_categories_active ON ticket_categories(guild_id, is_active)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS ticket_categories');
}

module.exports = { up, down };
