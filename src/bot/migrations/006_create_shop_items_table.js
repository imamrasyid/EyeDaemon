/**
 * Migration: Create shop_items table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create shop_items table
    await db.query(`
        CREATE TABLE shop_items (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            price INTEGER NOT NULL,
            item_type TEXT NOT NULL,
            item_data JSON DEFAULT '{}',
            stock INTEGER DEFAULT -1,
            is_active BOOLEAN DEFAULT TRUE,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_shop_items_guild_id ON shop_items(guild_id)');
    await db.query('CREATE INDEX idx_shop_items_active ON shop_items(guild_id, is_active)');
    await db.query('CREATE INDEX idx_shop_items_type ON shop_items(guild_id, item_type)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS shop_items');
}

module.exports = { up, down };
