/**
 * Migration: Create music_queue_tracks table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create music_queue_tracks table
    await db.query(`
        CREATE TABLE music_queue_tracks (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            track_url TEXT NOT NULL,
            track_title TEXT NOT NULL,
            track_duration INTEGER NOT NULL,
            track_author TEXT,
            track_thumbnail TEXT,
            requested_by TEXT NOT NULL,
            position INTEGER NOT NULL,
            added_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (requested_by) REFERENCES user_profiles(user_id) ON DELETE CASCADE
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_music_queue_tracks_guild_id ON music_queue_tracks(guild_id)');
    await db.query('CREATE INDEX idx_music_queue_tracks_position ON music_queue_tracks(guild_id, position)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS music_queue_tracks');
}

module.exports = { up, down };
