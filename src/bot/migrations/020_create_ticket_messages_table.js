/**
 * Migration: Create ticket_messages table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create ticket_messages table
    await db.query(`
        CREATE TABLE ticket_messages (
            id TEXT PRIMARY KEY,
            ticket_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            content TEXT NOT NULL,
            attachments JSON DEFAULT '[]',
            created_at INTEGER NOT NULL,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_ticket_messages_ticket_id ON ticket_messages(ticket_id)');
    await db.query('CREATE INDEX idx_ticket_messages_created_at ON ticket_messages(ticket_id, created_at)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS ticket_messages');
}

module.exports = { up, down };
