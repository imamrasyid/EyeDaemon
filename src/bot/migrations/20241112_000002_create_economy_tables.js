/**
 * Migration: Create economy tables
 * Created: 2024-11-12
 */

module.exports = {
    name: 'Create economy tables',

    /**
     * Run the migration
     * @param {Database} db - SQLite database instance
     */
    up(db) {
        // Create economy table
        db.exec(`
      CREATE TABLE IF NOT EXISTS economy (
        id VARCHAR(255) PRIMARY KEY,
        member_id VARCHAR(255) NOT NULL,
        balance INTEGER DEFAULT 0,
        bank_balance INTEGER DEFAULT 0,
        daily_streak INTEGER DEFAULT 0,
        last_daily TIMESTAMP,
        last_work TIMESTAMP,
        inventory JSON DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        UNIQUE(member_id)
      )
    `);

        // Create shop_items table
        db.exec(`
      CREATE TABLE IF NOT EXISTS shop_items (
        id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        data JSON DEFAULT '{}',
        stock INTEGER DEFAULT -1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      )
    `);

        // Create transactions table
        db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        from_member_id VARCHAR(255),
        to_member_id VARCHAR(255),
        amount INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      )
    `);

        // Create indexes
        db.exec('CREATE INDEX IF NOT EXISTS idx_economy_member ON economy(member_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_economy_balance ON economy(balance DESC)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_shop_guild ON shop_items(guild_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_transactions_guild ON transactions(guild_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_member_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_member_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at DESC)');
    },

    /**
     * Rollback the migration
     * @param {Database} db - SQLite database instance
     */
    down(db) {
        db.exec('DROP INDEX IF EXISTS idx_transactions_date');
        db.exec('DROP INDEX IF EXISTS idx_transactions_to');
        db.exec('DROP INDEX IF EXISTS idx_transactions_from');
        db.exec('DROP INDEX IF EXISTS idx_transactions_guild');
        db.exec('DROP INDEX IF EXISTS idx_shop_guild');
        db.exec('DROP INDEX IF EXISTS idx_economy_balance');
        db.exec('DROP INDEX IF EXISTS idx_economy_member');
        db.exec('DROP TABLE IF EXISTS transactions');
        db.exec('DROP TABLE IF EXISTS shop_items');
        db.exec('DROP TABLE IF EXISTS economy');
    }
};
