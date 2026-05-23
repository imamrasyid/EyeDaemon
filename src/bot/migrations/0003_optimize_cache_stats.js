/**
 * Migration: Optimize Cache Statistics
 * 
 * Creates a cache_stats table with triggers to maintain pre-computed counts
 * This avoids expensive COUNT(*) queries on cache_entries table.
 * 
 * Based on Turso best practices: https://turso.tech/blog/tips-for-maximizing-your-turso-billing-allowances
 */

module.exports = {
    async up(db) {
        // Create cache_stats table to store pre-computed statistics
        await db.query(`
            CREATE TABLE IF NOT EXISTS cache_stats (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                total_entries INTEGER NOT NULL DEFAULT 0,
                expired_entries INTEGER NOT NULL DEFAULT 0,
                last_updated INTEGER NOT NULL
            )
        `);

        // Initialize with a single row
        const now = Date.now();
        await db.query(`
            INSERT OR IGNORE INTO cache_stats (id, total_entries, expired_entries, last_updated)
            VALUES (1, 0, 0, ?)
        `, [now]);

        // Create trigger to update total_entries on INSERT
        await db.query(`
            CREATE TRIGGER IF NOT EXISTS cache_entries_insert_total
            AFTER INSERT ON cache_entries
            BEGIN
                UPDATE cache_stats
                SET total_entries = total_entries + 1,
                    last_updated = (strftime('%s', 'now') * 1000)
                WHERE id = 1;
            END
        `);

        // Create trigger to update total_entries on DELETE
        await db.query(`
            CREATE TRIGGER IF NOT EXISTS cache_entries_delete_total
            AFTER DELETE ON cache_entries
            BEGIN
                UPDATE cache_stats
                SET total_entries = total_entries - 1,
                    last_updated = (strftime('%s', 'now') * 1000)
                WHERE id = 1;
            END
        `);

        // Create trigger to update expired_entries on INSERT (if expired)
        await db.query(`
            CREATE TRIGGER IF NOT EXISTS cache_entries_insert_expired
            AFTER INSERT ON cache_entries
            WHEN NEW.expires_at <= (strftime('%s', 'now') * 1000)
            BEGIN
                UPDATE cache_stats
                SET expired_entries = expired_entries + 1,
                    last_updated = (strftime('%s', 'now') * 1000)
                WHERE id = 1;
            END
        `);

        // Create trigger to update expired_entries on DELETE (if expired)
        await db.query(`
            CREATE TRIGGER IF NOT EXISTS cache_entries_delete_expired
            AFTER DELETE ON cache_entries
            WHEN OLD.expires_at <= (strftime('%s', 'now') * 1000)
            BEGIN
                UPDATE cache_stats
                SET expired_entries = expired_entries - 1,
                    last_updated = (strftime('%s', 'now') * 1000)
                WHERE id = 1;
            END
        `);

        // Create trigger to update expired_entries on UPDATE (when expires_at changes from expired to not expired)
        await db.query(`
            CREATE TRIGGER IF NOT EXISTS cache_entries_update_expired_to_active
            AFTER UPDATE OF expires_at ON cache_entries
            WHEN OLD.expires_at <= (strftime('%s', 'now') * 1000) AND NEW.expires_at > (strftime('%s', 'now') * 1000)
            BEGIN
                UPDATE cache_stats
                SET expired_entries = expired_entries - 1,
                    last_updated = (strftime('%s', 'now') * 1000)
                WHERE id = 1;
            END
        `);

        // Create trigger to update expired_entries on UPDATE (when expires_at changes from active to expired)
        await db.query(`
            CREATE TRIGGER IF NOT EXISTS cache_entries_update_active_to_expired
            AFTER UPDATE OF expires_at ON cache_entries
            WHEN OLD.expires_at > (strftime('%s', 'now') * 1000) AND NEW.expires_at <= (strftime('%s', 'now') * 1000)
            BEGIN
                UPDATE cache_stats
                SET expired_entries = expired_entries + 1,
                    last_updated = (strftime('%s', 'now') * 1000)
                WHERE id = 1;
            END
        `);

        // Initialize stats with current data
        const currentStats = await db.queryOne(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN expires_at <= ? THEN 1 ELSE 0 END) as expired
            FROM cache_entries
        `, [now]);

        if (currentStats) {
            await db.query(`
                UPDATE cache_stats
                SET total_entries = ?,
                    expired_entries = ?,
                    last_updated = ?
                WHERE id = 1
            `, [currentStats.total || 0, currentStats.expired || 0, now]);
        }
    },

    async down(db) {
        // Drop triggers
        await db.query('DROP TRIGGER IF EXISTS cache_entries_insert_total');
        await db.query('DROP TRIGGER IF EXISTS cache_entries_delete_total');
        await db.query('DROP TRIGGER IF EXISTS cache_entries_insert_expired');
        await db.query('DROP TRIGGER IF EXISTS cache_entries_delete_expired');
        await db.query('DROP TRIGGER IF EXISTS cache_entries_update_expired');
        await db.query('DROP TRIGGER IF EXISTS cache_entries_update_expired_new');

        // Drop cache_stats table
        await db.query('DROP TABLE IF EXISTS cache_stats');
    }
};
