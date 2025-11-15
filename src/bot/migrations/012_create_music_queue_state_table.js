/**
 * Migration: Create music_queue_state table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create music_queue_state table
    await db.query(`
        CREATE TABLE music_queue_state (
            guild_id TEXT PRIMARY KEY,
            current_track_index INTEGER DEFAULT 0,
            loop_mode TEXT DEFAULT 'off',
            volume INTEGER DEFAULT 80,
            audio_filter TEXT DEFAULT 'none',
            is_paused BOOLEAN DEFAULT FALSE,
            voice_channel_id TEXT,
            text_channel_id TEXT,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_music_queue_state_updated ON music_queue_state(updated_at)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS music_queue_state');
}

module.exports = { up, down };
