/**
 * Migration: Create music tables
 * Created: 2024-11-12
 */

module.exports = {
    name: 'Create music tables',

    /**
     * Run the migration
     * @param {Database} db - SQLite database instance
     */
    up(db) {
        // Create playlists table
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

        // Create indexes
        db.exec('CREATE INDEX IF NOT EXISTS idx_playlists_member ON playlists(member_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_playlists_public ON playlists(is_public)');
    },

    /**
     * Rollback the migration
     * @param {Database} db - SQLite database instance
     */
    down(db) {
        db.exec('DROP INDEX IF EXISTS idx_playlists_public');
        db.exec('DROP INDEX IF EXISTS idx_playlists_member');
        db.exec('DROP TABLE IF EXISTS playlists');
    }
};
