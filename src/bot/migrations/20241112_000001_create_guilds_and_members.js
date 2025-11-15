/**
 * Migration: Create guilds and members tables
 * Created: 2024-11-12
 */

module.exports = {
    name: 'Create guilds and members tables',

    /**
     * Run the migration
     * @param {Database} db - SQLite database instance
     */
    up(db) {
        // Create guilds table
        db.exec(`
      CREATE TABLE IF NOT EXISTS guilds (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_id VARCHAR(255) NOT NULL,
        prefix VARCHAR(10) DEFAULT '!',
        language VARCHAR(10) DEFAULT 'en',
        welcome_channel VARCHAR(255),
        welcome_message TEXT,
        goodbye_channel VARCHAR(255),
        goodbye_message TEXT,
        log_channel VARCHAR(255),
        mod_role VARCHAR(255),
        dj_role VARCHAR(255),
        settings JSON DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Create members table
        db.exec(`
      CREATE TABLE IF NOT EXISTS members (
        id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        username VARCHAR(255),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        roles JSON DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
        UNIQUE(guild_id, user_id)
      )
    `);

        // Create indexes for members table
        db.exec('CREATE INDEX IF NOT EXISTS idx_members_guild ON members(guild_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_members_active ON members(guild_id, is_active)');
    },

    /**
     * Rollback the migration
     * @param {Database} db - SQLite database instance
     */
    down(db) {
        db.exec('DROP INDEX IF EXISTS idx_members_active');
        db.exec('DROP INDEX IF EXISTS idx_members_user');
        db.exec('DROP INDEX IF EXISTS idx_members_guild');
        db.exec('DROP TABLE IF EXISTS members');
        db.exec('DROP TABLE IF EXISTS guilds');
    }
};
