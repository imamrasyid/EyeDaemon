/**
 * Migration: Create music queue state table
 * Created: 2024-11-13
 * 
 * Creates table for persisting music queue state across bot restarts
 */

module.exports = {
  name: 'Create music queue state table',

  /**
   * Run the migration
   * @param {Database} db - SQLite database instance
   */
  up(db) {
    // Create music_queue_state table
    db.exec(`
      CREATE TABLE IF NOT EXISTS music_queue_state (
        guild_id VARCHAR(255) PRIMARY KEY,
        queue_data TEXT NOT NULL,
        current_position INTEGER DEFAULT 0,
        loop_mode VARCHAR(20) DEFAULT 'off',
        volume INTEGER DEFAULT 80,
        filter VARCHAR(50) DEFAULT 'none',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      )
    `);

    // Create index for faster lookups
    db.exec('CREATE INDEX IF NOT EXISTS idx_music_queue_state_updated ON music_queue_state(updated_at)');
  },

  /**
   * Rollback the migration
   * @param {Database} db - SQLite database instance
   */
  down(db) {
    db.exec('DROP INDEX IF EXISTS idx_music_queue_state_updated');
    db.exec('DROP TABLE IF EXISTS music_queue_state');
  }
};
