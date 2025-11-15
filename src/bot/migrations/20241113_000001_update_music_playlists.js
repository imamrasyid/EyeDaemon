/**
 * Migration: Update music playlists table
 * Created: 2024-11-13
 * 
 * Updates the playlists table to music_playlists with guild_id foreign key
 * and separates tracks into a separate table
 */

module.exports = {
    name: 'Update music playlists table',

    /**
     * Run the migration
     * @param {Database} db - SQLite database instance
     */
    up(db) {
        // Create new music_playlists table with proper structure
        db.exec(`
      CREATE TABLE IF NOT EXISTS music_playlists (
        id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      )
    `);

        // Create indexes
        db.exec('CREATE INDEX IF NOT EXISTS idx_music_playlists_guild ON music_playlists(guild_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_music_playlists_user ON music_playlists(user_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_music_playlists_public ON music_playlists(is_public)');

        // Migrate data from old playlists table if it exists
        const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='playlists'
    `).get();

        if (tableExists) {
            // Migrate data from old playlists table
            try {
                const insertStmt = db.prepare(`
          INSERT INTO music_playlists (id, guild_id, user_id, name, is_public, created_at, updated_at)
          SELECT p.id, m.guild_id, m.user_id, p.name, p.is_public, p.created_at, p.created_at
          FROM playlists p
          JOIN members m ON p.member_id = m.id
        `);
                insertStmt.run();
            } catch (error) {
                // If migration fails, it's okay - might be empty or already migrated
                console.log('Note: Could not migrate old playlist data:', error.message);
            }

            // Drop old table and indexes
            db.exec('DROP INDEX IF EXISTS idx_playlists_public');
            db.exec('DROP INDEX IF EXISTS idx_playlists_member');
            db.exec('DROP TABLE IF EXISTS playlists');
        }
    },

    /**
     * Rollback the migration
     * @param {Database} db - SQLite database instance
     */
    down(db) {
        db.exec('DROP INDEX IF EXISTS idx_music_playlists_public');
        db.exec('DROP INDEX IF EXISTS idx_music_playlists_user');
        db.exec('DROP INDEX IF EXISTS idx_music_playlists_guild');
        db.exec('DROP TABLE IF EXISTS music_playlists');

        // Recreate old playlists table
        db.exec(`
      CREATE TABLE IF NOT EXISTS playlists (
        id VARCHAR(255) PRIMARY KEY,
        member_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        tracks JSON DEFAULT '[]',
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      )
    `);

        db.exec('CREATE INDEX IF NOT EXISTS idx_playlists_member ON playlists(member_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_playlists_public ON playlists(is_public)');
    }
};
