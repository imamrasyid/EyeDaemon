/**
 * Migration: Create music playlist tracks table
 * Created: 2024-11-13
 * 
 * Creates a separate table for playlist tracks instead of storing as JSON
 */

module.exports = {
    name: 'Create music playlist tracks table',

    /**
     * Run the migration
     * @param {Database} db - SQLite database instance
     */
    up(db) {
        // Create music_playlist_tracks table
        db.exec(`
      CREATE TABLE IF NOT EXISTS music_playlist_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id VARCHAR(255) NOT NULL,
        track_data JSON NOT NULL,
        position INTEGER NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (playlist_id) REFERENCES music_playlists(id) ON DELETE CASCADE
      )
    `);

        // Create indexes
        db.exec('CREATE INDEX IF NOT EXISTS idx_music_playlist_tracks_playlist ON music_playlist_tracks(playlist_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_music_playlist_tracks_position ON music_playlist_tracks(playlist_id, position)');

        // Migrate tracks from old playlists table if data exists in music_playlists
        // This handles the case where tracks were stored as JSON in the old structure
        try {
            const playlists = db.prepare('SELECT id FROM music_playlists').all();

            // Note: Since we're moving from JSON tracks to separate table,
            // and the old playlists table has been dropped, there's no data to migrate here.
            // This migration creates the new structure for future use.
        } catch (error) {
            // Table might not exist yet, which is fine
            console.log('Note: music_playlists table not found, skipping data migration');
        }
    },

    /**
     * Rollback the migration
     * @param {Database} db - SQLite database instance
     */
    down(db) {
        db.exec('DROP INDEX IF EXISTS idx_music_playlist_tracks_position');
        db.exec('DROP INDEX IF EXISTS idx_music_playlist_tracks_playlist');
        db.exec('DROP TABLE IF EXISTS music_playlist_tracks');
    }
};
