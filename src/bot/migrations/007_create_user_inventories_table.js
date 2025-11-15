/**
 * Migration: Create user_inventories table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create user_inventories table
    await db.query(`
        CREATE TABLE user_inventories (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            quantity INTEGER DEFAULT 1,
            acquired_at INTEGER NOT NULL,
            metadata JSON DEFAULT '{}',
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
            FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE,
            UNIQUE(guild_id, user_id, item_id)
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_user_inventories_guild_user ON user_inventories(guild_id, user_id)');
    await db.query('CREATE INDEX idx_user_inventories_item ON user_inventories(item_id)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS user_inventories');
}

module.exports = { up, down };
