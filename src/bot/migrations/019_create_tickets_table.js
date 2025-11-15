/**
 * Migration: Create tickets table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create tickets table
    await db.query(`
        CREATE TABLE tickets (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL UNIQUE,
            user_id TEXT NOT NULL,
            category_id TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            claimed_by TEXT,
            priority TEXT DEFAULT 'normal',
            created_at INTEGER NOT NULL,
            claimed_at INTEGER,
            closed_at INTEGER,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE CASCADE,
            FOREIGN KEY (claimed_by) REFERENCES user_profiles(user_id) ON DELETE SET NULL
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_tickets_guild_id ON tickets(guild_id)');
    await db.query('CREATE INDEX idx_tickets_user_id ON tickets(user_id)');
    await db.query('CREATE INDEX idx_tickets_status ON tickets(guild_id, status)');
    await db.query('CREATE INDEX idx_tickets_category ON tickets(category_id)');
    await db.query('CREATE INDEX idx_tickets_created_at ON tickets(created_at DESC)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS tickets');
}

module.exports = { up, down };
