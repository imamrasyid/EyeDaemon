/**
 * Migration: Create user_profiles table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create user_profiles table
    await db.query(`
        CREATE TABLE user_profiles (
            user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            discriminator TEXT,
            avatar_url TEXT,
            bot BOOLEAN DEFAULT FALSE,
            global_settings JSON DEFAULT '{}',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_user_profiles_username ON user_profiles(username)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS user_profiles');
}

module.exports = { up, down };
