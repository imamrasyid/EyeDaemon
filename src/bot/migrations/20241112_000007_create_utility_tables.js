/**
 * Migration: Create utility tables
 * Created: 2024-11-12
 */

module.exports = {
    name: 'Create utility tables',

    /**
     * Run the migration
     * @param {Database} db - SQLite database instance
     */
    up(db) {
        // Create reaction_roles table
        db.exec(`
      CREATE TABLE IF NOT EXISTS reaction_roles (
        id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        message_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        emoji VARCHAR(100) NOT NULL,
        role_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
        UNIQUE(message_id, emoji)
      )
    `);

        // Create auto_roles table
        db.exec(`
      CREATE TABLE IF NOT EXISTS auto_roles (
        id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        role_id VARCHAR(255) NOT NULL,
        condition VARCHAR(50) NOT NULL,
        data JSON DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      )
    `);

        // Create logs table
        db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      )
    `);

        // Create indexes
        db.exec('CREATE INDEX IF NOT EXISTS idx_reaction_roles_guild ON reaction_roles(guild_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_reaction_roles_message ON reaction_roles(message_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_auto_roles_guild ON auto_roles(guild_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_logs_guild ON logs(guild_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(event_type)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_logs_date ON logs(created_at DESC)');
    },

    /**
     * Rollback the migration
     * @param {Database} db - SQLite database instance
     */
    down(db) {
        db.exec('DROP INDEX IF EXISTS idx_logs_date');
        db.exec('DROP INDEX IF EXISTS idx_logs_type');
        db.exec('DROP INDEX IF EXISTS idx_logs_guild');
        db.exec('DROP INDEX IF EXISTS idx_auto_roles_guild');
        db.exec('DROP INDEX IF EXISTS idx_reaction_roles_message');
        db.exec('DROP INDEX IF EXISTS idx_reaction_roles_guild');
        db.exec('DROP TABLE IF EXISTS logs');
        db.exec('DROP TABLE IF EXISTS auto_roles');
        db.exec('DROP TABLE IF EXISTS reaction_roles');
    }
};
