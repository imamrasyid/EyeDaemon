/**
 * Migration: Create automod_config table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create automod_config table
    await db.query(`
        CREATE TABLE automod_config (
            guild_id TEXT PRIMARY KEY,
            spam_detection BOOLEAN DEFAULT FALSE,
            spam_threshold INTEGER DEFAULT 5,
            word_filter_enabled BOOLEAN DEFAULT FALSE,
            filtered_words JSON DEFAULT '[]',
            link_filter_enabled BOOLEAN DEFAULT FALSE,
            allowed_domains JSON DEFAULT '[]',
            caps_filter_enabled BOOLEAN DEFAULT FALSE,
            caps_threshold INTEGER DEFAULT 70,
            emoji_filter_enabled BOOLEAN DEFAULT FALSE,
            emoji_threshold INTEGER DEFAULT 10,
            raid_protection BOOLEAN DEFAULT FALSE,
            settings JSON DEFAULT '{}',
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
        )
    `);
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS automod_config');
}

module.exports = { up, down };
