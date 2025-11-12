const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const CONFIG = require('../config');
const { database: logger, createQueryLogger } = require('./logging.service');

class DatabaseService {
  constructor() {
    this.db = null;
    this.initialized = false;
    this.queryLogger = createQueryLogger('DATABASE');
  }

  async initialize() {
    try {
      // Ensure data directory exists
      const dbPath = path.dirname(CONFIG.DATABASE.PATH);
      if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
      }

      // Initialize database connection
      this.db = new Database(CONFIG.DATABASE.PATH, {
        verbose: (message) => logger.debug(message)
      });

      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');

      // Set busy timeout
      this.db.pragma('busy_timeout = 5000');

      // Initialize tables
      await this.initializeTables();

      this.initialized = true;
      logger.info('Database service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize database service', { error: error.message });
      throw error;
    }
  }

  async initializeTables() {
    const tables = [
      // Guilds table
      `CREATE TABLE IF NOT EXISTS guilds (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_id VARCHAR(255) NOT NULL,
        prefix VARCHAR(10) DEFAULT '!',
        language VARCHAR(10) DEFAULT 'en',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        settings JSON DEFAULT '{}'
      )`,

      // Members table
      `CREATE TABLE IF NOT EXISTS members (
        id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        roles JSON DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
        UNIQUE(guild_id, user_id)
      )`,

      // Economy table
      `CREATE TABLE IF NOT EXISTS economy (
        id VARCHAR(255) PRIMARY KEY,
        member_id VARCHAR(255) NOT NULL,
        balance INTEGER DEFAULT 0,
        bank_balance INTEGER DEFAULT 0,
        daily_streak INTEGER DEFAULT 0,
        last_daily TIMESTAMP,
        inventory JSON DEFAULT '[]',
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        UNIQUE(member_id)
      )`,

      // Leveling table
      `CREATE TABLE IF NOT EXISTS leveling (
        id VARCHAR(255) PRIMARY KEY,
        member_id VARCHAR(255) NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        total_messages INTEGER DEFAULT 0,
        voice_time INTEGER DEFAULT 0,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        UNIQUE(member_id)
      )`,

      // Playlists table
      `CREATE TABLE IF NOT EXISTS playlists (
        id VARCHAR(255) PRIMARY KEY,
        member_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        tracks JSON DEFAULT '[]',
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      )`,

      // Warnings table
      `CREATE TABLE IF NOT EXISTS warnings (
        id VARCHAR(255) PRIMARY KEY,
        member_id VARCHAR(255) NOT NULL,
        reason TEXT NOT NULL,
        warned_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      )`,

      // Logs table
      `CREATE TABLE IF NOT EXISTS logs (
        id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NULL,
        event_type VARCHAR(50) NOT NULL,
        data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE SET NULL
      )`,

      // Tickets table
      `CREATE TABLE IF NOT EXISTS tickets (
        id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        member_id VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'open',
        category VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      )`,

      // Settings table
      `CREATE TABLE IF NOT EXISTS settings (
        id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        key VARCHAR(100) NOT NULL,
        value JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
        UNIQUE(guild_id, key)
      )`,

      // Role permissions table
      `CREATE TABLE IF NOT EXISTS role_permissions (
        guild_id VARCHAR(255) NOT NULL,
        role_id VARCHAR(255) NOT NULL,
        permission VARCHAR(255) NOT NULL,
        PRIMARY KEY (guild_id, role_id, permission)
      )`,

      // User permissions table
      `CREATE TABLE IF NOT EXISTS user_permissions (
        guild_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        permission VARCHAR(255) NOT NULL,
        PRIMARY KEY (guild_id, user_id, permission)
      )`,

      // Guild settings table
      `CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id VARCHAR(255) NOT NULL,
        key VARCHAR(100) NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (guild_id, key)
      )`
    ];

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_members_guild ON members(guild_id)',
      'CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_members_active ON members(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_economy_member ON economy(member_id)',
      'CREATE INDEX IF NOT EXISTS idx_economy_balance ON economy(balance DESC)',
      'CREATE INDEX IF NOT EXISTS idx_leveling_member ON leveling(member_id)',
      'CREATE INDEX IF NOT EXISTS idx_leveling_level ON leveling(level DESC)',
      'CREATE INDEX IF NOT EXISTS idx_leveling_xp ON leveling(xp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_playlists_member ON playlists(member_id)',
      'CREATE INDEX IF NOT EXISTS idx_playlists_public ON playlists(is_public)',
      'CREATE INDEX IF NOT EXISTS idx_warnings_member ON warnings(member_id)',
      'CREATE INDEX IF NOT EXISTS idx_warnings_active ON warnings(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_logs_guild ON logs(guild_id)',
      'CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(event_type)',
      'CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id)',
      'CREATE INDEX IF NOT EXISTS idx_tickets_member ON tickets(member_id)',
      'CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)',
      'CREATE INDEX IF NOT EXISTS idx_settings_guild ON settings(guild_id)',
      'CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key)',
      'CREATE INDEX IF NOT EXISTS idx_role_perm_guild_role ON role_permissions(guild_id, role_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_perm_guild_user ON user_permissions(guild_id, user_id)'
    ];

    // Execute table creation
    for (const table of tables) {
      const start = process.hrtime.bigint();
      this.db.exec(table);
      const duration = Number(process.hrtime.bigint() - start) / 1000000;
      this.queryLogger.query(table, [], duration);
    }

    // Execute index creation
    for (const index of indexes) {
      const start = process.hrtime.bigint();
      this.db.exec(index);
      const duration = Number(process.hrtime.bigint() - start) / 1000000;
      this.queryLogger.query(index, [], duration);
    }

    logger.info('Database tables initialized successfully');
  }

  // Query execution with performance monitoring
  async query(sql, params = []) {
    const start = process.hrtime.bigint();

    try {
      const statement = this.db.prepare(sql);
      const result = params.length > 0 ? statement.run(params) : statement.run();

      const duration = Number(process.hrtime.bigint() - start) / 1000000;
      this.queryLogger.query(sql, params, duration);

      return result;
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - start) / 1000000;
      this.queryLogger.error(sql, error, params);
      throw error;
    }
  }

  // Get query with performance monitoring
  async get(sql, params = []) {
    const start = process.hrtime.bigint();

    try {
      const statement = this.db.prepare(sql);
      const result = params.length > 0 ? statement.get(params) : statement.get();

      const duration = Number(process.hrtime.bigint() - start) / 1000000;
      this.queryLogger.query(sql, params, duration);

      return result;
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - start) / 1000000;
      this.queryLogger.error(sql, error, params);
      throw error;
    }
  }

  // Get all query with performance monitoring
  async all(sql, params = []) {
    const start = process.hrtime.bigint();

    try {
      const statement = this.db.prepare(sql);
      const result = params.length > 0 ? statement.all(params) : statement.all();

      const duration = Number(process.hrtime.bigint() - start) / 1000000;
      this.queryLogger.query(sql, params, duration);

      return result;
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - start) / 1000000;
      this.queryLogger.error(sql, error, params);
      throw error;
    }
  }

  // Transaction support
  async transaction(callback) {
    const start = process.hrtime.bigint();

    try {
      const result = this.db.transaction(callback)();
      const duration = Number(process.hrtime.bigint() - start) / 1000000;

      logger.info('Transaction completed', { duration: `${duration.toFixed(2)}ms` });
      return result;
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - start) / 1000000;
      logger.error('Transaction failed', { duration: `${duration.toFixed(2)}ms`, error: error.message });
      throw error;
    }
  }

  // Database health check
  async healthCheck() {
    try {
      const start = process.hrtime.bigint();
      const result = this.db.prepare('SELECT 1 as health').get();
      const duration = Number(process.hrtime.bigint() - start) / 1000000;

      return {
        status: 'healthy',
        responseTime: `${duration.toFixed(2)}ms`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Close database connection
  async close() {
    if (this.db) {
      this.db.close();
      logger.info('Database connection closed');
    }
  }

  // Get database statistics
  async getStats() {
    try {
      const tables = ['guilds', 'members', 'economy', 'leveling', 'playlists', 'warnings', 'logs', 'tickets', 'settings'];
      const stats = {};

      for (const table of tables) {
        const result = await this.get(`SELECT COUNT(*) as count FROM ${table}`);
        stats[table] = result?.count || 0;
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get database stats', { error: error.message });
      return {};
    }
  }
}

// Singleton instance
let instance = null;

const getDatabaseService = () => {
  if (!instance) {
    instance = new DatabaseService();
  }
  return instance;
};

module.exports = {
  DatabaseService,
  getDatabaseService
};
