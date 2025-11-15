/**
 * Migration: Create guilds table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create guilds table
    await db.query(`
        CREATE TABLE guilds (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            icon_url TEXT,
            member_count INTEGER DEFAULT 0,
            settings JSON DEFAULT '{}',
            created_at INTEGER NOT NULL,
            joined_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_guilds_owner_id ON guilds(owner_id)');
    await db.query('CREATE INDEX idx_guilds_joined_at ON guilds(joined_at)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS guilds');
}

module.exports = { up, down };
