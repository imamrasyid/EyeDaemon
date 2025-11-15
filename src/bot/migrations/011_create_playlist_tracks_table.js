/**
 * Migration: Create playlist_tracks table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create playlist_tracks table
    await db.query(`
        CREATE TABLE playlist_tracks (
            id TEXT PRIMARY KEY,
            playlist_id TEXT NOT NULL,
            track_url TEXT NOT NULL,
            track_title TEXT NOT NULL,
            track_duration INTEGER NOT NULL,
            track_author TEXT,
            track_thumbnail TEXT,
            position INTEGER NOT NULL,
            added_at INTEGER NOT NULL,
            FOREIGN KEY (playlist_id) REFERENCES user_playlists(id) ON DELETE CASCADE
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id)');
    await db.query('CREATE INDEX idx_playlist_tracks_position ON playlist_tracks(playlist_id, position)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS playlist_tracks');
}

module.exports = { up, down };
