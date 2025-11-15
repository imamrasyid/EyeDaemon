/**
 * Migration: Create moderation tables
 * Created: 2024-11-12
 */

module.exports = {
    name: 'Create moderation tables',

    /**
     * Run the migration
     * @param {Database} db - SQLite database instance
     */
    up(db) {
        // Create warnings table
        db.exec(`
      CREATE TABLE IF NOT EXISTS warnings (
        id VARCHAR(255) PRIMARY KEY,
        member_id VARCHAR(255) NOT NULL,
        reason TEXT NOT NULL,
        warned_by VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      )
    `);

        // Create moderation_logs table
        db.exec(`
      CREATE TABLE IF NOT EXISTS moderation_logs (
        id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        action VARCHAR(50) NOT NULL,
        target_id VARCHAR(255) NOT NULL,
        moderator_id VARCHAR(255) NOT NULL,
        reason TEXT,
        data JSON DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      )
    `);

        // Create automod_config table
        db.exec(`
      CREATE TABLE IF NOT EXISTS automod_config (
        guild_id VARCHAR(255) PRIMARY KEY,
        spam_detection BOOLEAN DEFAULT false,
        word_filter JSON DEFAULT '[]',
        link_filter BOOLEAN DEFAULT false,
        caps_filter BOOLEAN DEFAULT false,
        emoji_filter BOOLEAN DEFAULT false,
        raid_protection BOOLEAN DEFAULT false,
        settings JSON DEFAULT '{}',
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      )
    `);

        // Create indexes
        db.exec('CREATE INDEX IF NOT EXISTS idx_warnings_member ON warnings(member_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_warnings_active ON warnings(is_active)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_modlogs_guild ON moderation_logs(guild_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_modlogs_target ON moderation_logs(target_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_modlogs_moderator ON moderation_logs(moderator_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_modlogs_date ON moderation_logs(created_at DESC)');
    },

    /**
     * Rollback the migration
     * @param {Database} db - SQLite database instance
     */
    down(db) {
        db.exec('DROP INDEX IF EXISTS idx_modlogs_date');
        db.exec('DROP INDEX IF EXISTS idx_modlogs_moderator');
        db.exec('DROP INDEX IF EXISTS idx_modlogs_target');
        db.exec('DROP INDEX IF EXISTS idx_modlogs_guild');
        db.exec('DROP INDEX IF EXISTS idx_warnings_active');
        db.exec('DROP INDEX IF EXISTS idx_warnings_member');
        db.exec('DROP TABLE IF EXISTS automod_config');
        db.exec('DROP TABLE IF EXISTS moderation_logs');
        db.exec('DROP TABLE IF EXISTS warnings');
    }
};
