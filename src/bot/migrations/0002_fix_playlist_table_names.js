/**
 * Migration: 0002_fix_playlist_table_names
 * 
 * Fixes the playlist table names from user_playlists/playlist_tracks
 * to music_playlists/music_playlist_tracks to match the service code.
 */

module.exports = {
    name: '0002_fix_playlist_table_names',

    async up(db) {
        // Check if old tables exist
        const oldTableExists = await db.queryOne(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='user_playlists'
        `);

        if (oldTableExists) {
            // Rename user_playlists to music_playlists
            await db.query(`ALTER TABLE user_playlists RENAME TO music_playlists`);

            // Rename playlist_tracks to music_playlist_tracks
            await db.query(`ALTER TABLE playlist_tracks RENAME TO music_playlist_tracks`);

            // Drop old indexes if they exist
            await db.query(`DROP INDEX IF EXISTS idx_user_playlists_guild_user`);
            await db.query(`DROP INDEX IF EXISTS idx_playlist_tracks_playlist`);

            // Create new indexes
            await db.query(`CREATE INDEX IF NOT EXISTS idx_music_playlists_guild_user ON music_playlists(guild_id, user_id)`);
            await db.query(`CREATE INDEX IF NOT EXISTS idx_music_playlist_tracks_playlist ON music_playlist_tracks(playlist_id)`);
        } else {
            // Tables don't exist yet, create them with correct names
            await db.query(`CREATE TABLE IF NOT EXISTS music_playlists (
                id TEXT PRIMARY KEY,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                is_public BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
            )`);
            await db.query(`CREATE INDEX IF NOT EXISTS idx_music_playlists_guild_user ON music_playlists(guild_id, user_id)`);

            await db.query(`CREATE TABLE IF NOT EXISTS music_playlist_tracks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                playlist_id TEXT NOT NULL,
                track_data TEXT NOT NULL,
                position INTEGER NOT NULL,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (playlist_id) REFERENCES music_playlists(id) ON DELETE CASCADE
            )`);
            await db.query(`CREATE INDEX IF NOT EXISTS idx_music_playlist_tracks_playlist ON music_playlist_tracks(playlist_id)`);
        }
    },

    async down(db) {
        // Rename back to old names
        await db.query(`ALTER TABLE music_playlists RENAME TO user_playlists`);
        await db.query(`ALTER TABLE music_playlist_tracks RENAME TO playlist_tracks`);

        // Drop new indexes
        await db.query(`DROP INDEX IF EXISTS idx_music_playlists_guild_user`);
        await db.query(`DROP INDEX IF EXISTS idx_music_playlist_tracks_playlist`);

        // Create old indexes
        await db.query(`CREATE INDEX IF NOT EXISTS idx_user_playlists_guild_user ON user_playlists(guild_id, user_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id)`);
    }
};
