/**
 * Migration: Create auto_roles table
 * Created: 2024-11-14
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Create auto_roles table
    await db.query(`
        CREATE TABLE auto_roles (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            role_id TEXT NOT NULL,
            condition_type TEXT NOT NULL,
            condition_data JSON DEFAULT '{}',
            is_active BOOLEAN DEFAULT TRUE,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
        )
    `);

    // Create indexes
    await db.query('CREATE INDEX idx_auto_roles_guild_id ON auto_roles(guild_id)');
    await db.query('CREATE INDEX idx_auto_roles_condition ON auto_roles(guild_id, condition_type)');
    await db.query('CREATE INDEX idx_auto_roles_active ON auto_roles(guild_id, is_active)');
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    await db.query('DROP TABLE IF EXISTS auto_roles');
}

module.exports = { up, down };
