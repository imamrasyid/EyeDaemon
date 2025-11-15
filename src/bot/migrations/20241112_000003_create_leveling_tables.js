/**
 * Migration: Create leveling tables
 * Created: 2024-11-12
 */

module.exports = {
    name: 'Create leveling tables',

    /**
     * Run the migration
     * @param {Database} db - SQLite database instance
     */
    up(db) {
        // Create leveling table
        db.exec(`
      CREATE TABLE IF NOT EXISTS leveling (
        id VARCHAR(255) PRIMARY KEY,
        member_id VARCHAR(255) NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        total_messages INTEGER DEFAULT 0,
        voice_time INTEGER DEFAULT 0,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        UNIQUE(member_id)
      )
    `);

        // Create level_rewards table
        db.exec(`
      CREATE TABLE IF NOT EXISTS level_rewards (
        id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        level INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
        UNIQUE(guild_id, level, type)
      )
    `);

        // Create indexes
        db.exec('CREATE INDEX IF NOT EXISTS idx_leveling_member ON leveling(member_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_leveling_level ON leveling(level DESC)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_leveling_xp ON leveling(xp DESC)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_rewards_guild ON level_rewards(guild_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_rewards_level ON level_rewards(level)');
    },

    /**
     * Rollback the migration
     * @param {Database} db - SQLite database instance
     */
    down(db) {
        db.exec('DROP INDEX IF EXISTS idx_rewards_level');
        db.exec('DROP INDEX IF EXISTS idx_rewards_guild');
        db.exec('DROP INDEX IF EXISTS idx_leveling_xp');
        db.exec('DROP INDEX IF EXISTS idx_leveling_level');
        db.exec('DROP INDEX IF EXISTS idx_leveling_member');
        db.exec('DROP TABLE IF EXISTS level_rewards');
        db.exec('DROP TABLE IF EXISTS leveling');
    }
};
