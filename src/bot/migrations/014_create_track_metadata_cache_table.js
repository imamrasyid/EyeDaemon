/**
 * Migration: Create track_metadata_cache table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create track_metadata_cache table
    await db.query(`
        CREATE TABLE track_metadata_cache (
            id TEXT PRIMARY KEY,
            query TEXT NOT NULL UNIQUE,
            track_url TEXT NOT NULL,
            track_title TEXT NOT NULL,
            track_duration INTEGER NOT NULL,
            track_author TEXT,
            track_thumbnail TEXT,
            source TEXT NOT NULL,
            metadata JSON DEFAULT '{}',
            hit_count INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_track_metadata_cache_query ON track_metadata_cache(query)');
    await db.query('CREATE INDEX idx_track_metadata_cache_expires ON track_metadata_cache(expires_at)');
    await db.query('CREATE INDEX idx_track_metadata_cache_hit_count ON track_metadata_cache(hit_count DESC)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS track_metadata_cache');
}

module.exports = { up, down };
