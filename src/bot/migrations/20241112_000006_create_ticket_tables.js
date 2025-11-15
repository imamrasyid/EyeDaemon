/**
 * Migration: Create ticket tables
 * Created: 2024-11-12
 */

module.exports = {
    name: 'Create ticket tables',

    /**
     * Run the migration
     * @param {Database} db - SQLite database instance
     */
    up(db) {
        // Create tickets table
        db.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        member_id VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'open',
        claimed_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      )
    `);

        // Create ticket_categories table
        db.exec(`
      CREATE TABLE IF NOT EXISTS ticket_categories (
        id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        staff_roles JSON DEFAULT '[]',
        auto_response TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
        UNIQUE(guild_id, name)
      )
    `);

        // Create ticket_transcripts table
        db.exec(`
      CREATE TABLE IF NOT EXISTS ticket_transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id VARCHAR(255) NOT NULL,
        transcript TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      )
    `);

        // Create indexes
        db.exec('CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_tickets_member ON tickets(member_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_categories_guild ON ticket_categories(guild_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_transcripts_ticket ON ticket_transcripts(ticket_id)');
    },

    /**
     * Rollback the migration
     * @param {Database} db - SQLite database instance
     */
    down(db) {
        db.exec('DROP INDEX IF EXISTS idx_ticket_transcripts_ticket');
        db.exec('DROP INDEX IF EXISTS idx_ticket_categories_guild');
        db.exec('DROP INDEX IF EXISTS idx_tickets_status');
        db.exec('DROP INDEX IF EXISTS idx_tickets_member');
        db.exec('DROP INDEX IF EXISTS idx_tickets_guild');
        db.exec('DROP TABLE IF EXISTS ticket_transcripts');
        db.exec('DROP TABLE IF EXISTS ticket_categories');
        db.exec('DROP TABLE IF EXISTS tickets');
    }
};
