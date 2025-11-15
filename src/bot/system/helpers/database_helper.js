/**
 * Database Helper
 * 
 * Provides database initialization and schema management utilities.
 */

/**
 * Initialize database schema
 * Creates all necessary tables if they don't exist
 * @param {Object} db - Database instance
 */
async function initializeSchema(db) {
    const logger = db.logger || console;

    try {
        logger.info('[DatabaseHelper] Initializing database schema...');

        // Temporarily disable performance logging for schema initialization
        const perfLoggingEnabled = db.performanceLogger?.isEnabled();
        if (perfLoggingEnabled) {
            db.disablePerformanceLogging();
        }

        // Check if schema is already initialized
        const schemaCheck = await db.query(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='guilds'
        `);

        if (schemaCheck && schemaCheck.length > 0) {
            logger.info('[DatabaseHelper] Schema already initialized, skipping...');

            // Re-enable performance logging
            if (perfLoggingEnabled) {
                db.enablePerformanceLogging();
            }
            return;
        }

        // Use batch operation for faster schema creation
        const statements = [
            // Create guilds table
            {
                sql: `CREATE TABLE IF NOT EXISTS guilds (
                    guild_id TEXT PRIMARY KEY,
                    guild_name TEXT NOT NULL,
                    config TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                args: []
            },
            // Create members table
            {
                sql: `CREATE TABLE IF NOT EXISTS members (
                    id TEXT PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(guild_id, user_id)
                )`,
                args: []
            },
            // Create economy table
            {
                sql: `CREATE TABLE IF NOT EXISTS economy (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    member_id TEXT NOT NULL UNIQUE,
                    balance INTEGER DEFAULT 0,
                    bank_balance INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
                )`,
                args: []
            },
            // Create leveling table
            {
                sql: `CREATE TABLE IF NOT EXISTS leveling (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    member_id TEXT NOT NULL UNIQUE,
                    xp INTEGER DEFAULT 0,
                    level INTEGER DEFAULT 1,
                    total_messages INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
                )`,
                args: []
            },
            // Create moderation_logs table
            {
                sql: `CREATE TABLE IF NOT EXISTS moderation_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    guild_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    moderator_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    reason TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                args: []
            },
            // Create warnings table
            {
                sql: `CREATE TABLE IF NOT EXISTS warnings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    guild_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    moderator_id TEXT NOT NULL,
                    reason TEXT,
                    active INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                args: []
            },
            // Create economy_transactions table
            {
                sql: `CREATE TABLE IF NOT EXISTS economy_transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    member_id TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    type TEXT NOT NULL,
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
                )`,
                args: []
            },
            // Create shop_items table
            {
                sql: `CREATE TABLE IF NOT EXISTS shop_items (
                    id TEXT PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    price INTEGER NOT NULL,
                    role_id TEXT,
                    stock INTEGER DEFAULT -1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                args: []
            },
            // Create user_inventory table
            {
                sql: `CREATE TABLE IF NOT EXISTS user_inventory (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    member_id TEXT NOT NULL,
                    item_id TEXT NOT NULL,
                    quantity INTEGER DEFAULT 1,
                    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
                    FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE
                )`,
                args: []
            },
            // Create music_playlists table
            {
                sql: `CREATE TABLE IF NOT EXISTS music_playlists (
                    id TEXT PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    is_public INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                args: []
            },
            // Create music_playlist_tracks table
            {
                sql: `CREATE TABLE IF NOT EXISTS music_playlist_tracks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    playlist_id TEXT NOT NULL,
                    track_data TEXT NOT NULL,
                    position INTEGER NOT NULL,
                    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (playlist_id) REFERENCES music_playlists(id) ON DELETE CASCADE
                )`,
                args: []
            },
            // Create music_queue_state table
            {
                sql: `CREATE TABLE IF NOT EXISTS music_queue_state (
                    guild_id TEXT PRIMARY KEY,
                    queue_data TEXT,
                    current_position INTEGER DEFAULT 0,
                    loop_mode TEXT DEFAULT 'off',
                    volume INTEGER DEFAULT 80,
                    filter TEXT DEFAULT 'none',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                args: []
            },
            // Create indexes
            { sql: `CREATE INDEX IF NOT EXISTS idx_members_guild_user ON members(guild_id, user_id)`, args: [] },
            { sql: `CREATE INDEX IF NOT EXISTS idx_economy_member ON economy(member_id)`, args: [] },
            { sql: `CREATE INDEX IF NOT EXISTS idx_leveling_member ON leveling(member_id)`, args: [] },
            { sql: `CREATE INDEX IF NOT EXISTS idx_moderation_logs_guild ON moderation_logs(guild_id)`, args: [] },
            { sql: `CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id)`, args: [] },
            { sql: `CREATE INDEX IF NOT EXISTS idx_economy_transactions_member ON economy_transactions(member_id)`, args: [] },
            { sql: `CREATE INDEX IF NOT EXISTS idx_shop_items_guild ON shop_items(guild_id)`, args: [] },
            { sql: `CREATE INDEX IF NOT EXISTS idx_user_inventory_member ON user_inventory(member_id)`, args: [] },
            { sql: `CREATE INDEX IF NOT EXISTS idx_music_playlists_guild_user ON music_playlists(guild_id, user_id)`, args: [] },
            { sql: `CREATE INDEX IF NOT EXISTS idx_music_playlist_tracks_playlist ON music_playlist_tracks(playlist_id)`, args: [] }
        ];

        // Execute all statements in a single batch
        logger.info('[DatabaseHelper] Creating tables and indexes in batch...');
        await db.batch(statements);

        // Re-enable performance logging
        if (perfLoggingEnabled) {
            db.enablePerformanceLogging();
        }

        logger.info('[DatabaseHelper] Database schema initialized successfully');
    } catch (error) {
        logger.error('[DatabaseHelper] Failed to initialize database schema', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

module.exports = {
    initializeSchema
};
