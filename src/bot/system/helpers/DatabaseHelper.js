'use strict';

/**
 * Database Helper
 *
 * Provides database initialization and schema management utilities.
 * Schema is defined by migration 0004_consolidated_schema.js.
 * This helper performs startup-time existence checks and creates
 * any tables missing from a partially-applied migration.
 */

const SCHEMA_DEFINITIONS = [
  {
    sql: `CREATE TABLE IF NOT EXISTS guilds (
      guild_id      TEXT PRIMARY KEY,
      name          TEXT,
      config_json   TEXT DEFAULT '{}' NOT NULL,
      prefix        TEXT DEFAULT '!',
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS user_profiles (
      user_id       TEXT PRIMARY KEY,
      username      TEXT,
      display_name  TEXT,
      avatar_url    TEXT,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS economy_accounts (
      user_id           TEXT NOT NULL,
      guild_id          TEXT NOT NULL,
      balance           INTEGER NOT NULL DEFAULT 0,
      bank_balance      INTEGER NOT NULL DEFAULT 0,
      last_daily        INTEGER,
      last_weekly       INTEGER,
      created_at        INTEGER NOT NULL,
      updated_at        INTEGER NOT NULL,
      PRIMARY KEY (user_id, guild_id),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS economy_transactions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT NOT NULL,
      guild_id        TEXT NOT NULL,
      type            TEXT NOT NULL,
      amount          INTEGER NOT NULL,
      balance_before  INTEGER,
      balance_after   INTEGER,
      reason          TEXT,
      metadata_json   TEXT,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS economy_cooldowns (
      user_id       TEXT NOT NULL,
      guild_id      TEXT NOT NULL,
      action        TEXT NOT NULL,
      expires_at    INTEGER NOT NULL,
      PRIMARY KEY (user_id, guild_id, action),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS shop_items (
      id              TEXT PRIMARY KEY,
      guild_id        TEXT NOT NULL,
      name            TEXT NOT NULL,
      description     TEXT,
      price           INTEGER NOT NULL,
      role_id         TEXT,
      stock           INTEGER DEFAULT -1,
      data_json       TEXT,
      enabled         INTEGER DEFAULT 1 NOT NULL,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS user_inventories (
      user_id           TEXT NOT NULL,
      guild_id          TEXT NOT NULL,
      item_id           TEXT NOT NULL,
      quantity          INTEGER NOT NULL DEFAULT 1,
      created_at        INTEGER NOT NULL,
      PRIMARY KEY (user_id, guild_id, item_id),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS user_levels (
      user_id           TEXT NOT NULL,
      guild_id          TEXT NOT NULL,
      xp                INTEGER NOT NULL DEFAULT 0,
      level             INTEGER NOT NULL DEFAULT 0,
      last_message_at   INTEGER,
      created_at        INTEGER NOT NULL,
      updated_at        INTEGER NOT NULL,
      PRIMARY KEY (user_id, guild_id),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS level_rewards (
      guild_id      TEXT NOT NULL,
      level         INTEGER NOT NULL,
      reward_type   TEXT NOT NULL,
      data_json     TEXT,
      created_at    INTEGER NOT NULL,
      PRIMARY KEY (guild_id, level, reward_type),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS user_warnings (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT NOT NULL,
      guild_id        TEXT NOT NULL,
      moderator_id    TEXT NOT NULL,
      reason          TEXT NOT NULL,
      active          INTEGER DEFAULT 1 NOT NULL,
      expires_at      INTEGER,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS infractions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT NOT NULL,
      guild_id        TEXT NOT NULL,
      moderator_id    TEXT,
      type            TEXT NOT NULL,
      reason          TEXT NOT NULL,
      active          INTEGER DEFAULT 1 NOT NULL,
      expires_at      INTEGER,
      metadata_json   TEXT,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS audit_logs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id        TEXT NOT NULL,
      actor_id        TEXT,
      action          TEXT NOT NULL,
      category        TEXT,
      target_id       TEXT,
      details_json    TEXT,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS ticket_counters (
      guild_id      TEXT PRIMARY KEY,
      counter       INTEGER NOT NULL DEFAULT 0,
      last_number   INTEGER NOT NULL DEFAULT 0,
      updated_at    INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS tickets (
      id              TEXT PRIMARY KEY,
      guild_id        TEXT NOT NULL,
      channel_id      TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      category        TEXT DEFAULT 'general' NOT NULL,
      type            TEXT,
      status          TEXT DEFAULT 'open' NOT NULL,
      claimed_by      TEXT,
      close_user_id   TEXT,
      close_reason    TEXT,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER DEFAULT 0,
      closed_at       INTEGER,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS playlists (
      id              TEXT PRIMARY KEY,
      guild_id        TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      name            TEXT NOT NULL,
      description     TEXT,
      public          INTEGER DEFAULT 0 NOT NULL,
      data_json       TEXT,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS playlist_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id     TEXT NOT NULL,
      position        INTEGER NOT NULL,
      title           TEXT NOT NULL,
      url             TEXT NOT NULL,
      duration        INTEGER,
      requested_by    TEXT NOT NULL,
      added_at        INTEGER NOT NULL,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS queue_state (
      guild_id      TEXT PRIMARY KEY,
      data_json     TEXT NOT NULL,
      updated_at    INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS reaction_roles (
      message_id    TEXT NOT NULL,
      channel_id    TEXT NOT NULL,
      guild_id      TEXT NOT NULL,
      emoji         TEXT NOT NULL,
      role_id       TEXT NOT NULL,
      PRIMARY KEY (guild_id, channel_id, message_id, emoji),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS auto_roles (
      guild_id    TEXT NOT NULL,
      user_ids    TEXT NOT NULL,
      PRIMARY KEY (guild_id),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS event_logs (
      guild_id        TEXT NOT NULL,
      event_type      TEXT NOT NULL,
      channel_id      TEXT,
      data_json       TEXT,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS guild_whitelist (
      guild_id    TEXT NOT NULL,
      type        TEXT NOT NULL,
      target_id   TEXT NOT NULL,
      PRIMARY KEY (guild_id, type, target_id),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS guild_blacklist (
      guild_id    TEXT NOT NULL,
      type        TEXT NOT NULL,
      target_id   TEXT NOT NULL,
      PRIMARY KEY (guild_id, type, target_id),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS feature_toggles (
      guild_id    TEXT NOT NULL,
      feature     TEXT NOT NULL,
      enabled     INTEGER DEFAULT 1 NOT NULL,
      updated_at  INTEGER NOT NULL,
      PRIMARY KEY (guild_id, feature),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS auto_mod_rules (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id        TEXT NOT NULL,
      name            TEXT NOT NULL,
      event           TEXT NOT NULL,
      trigger_json    TEXT NOT NULL,
      action_json     TEXT NOT NULL,
      enabled         INTEGER DEFAULT 1 NOT NULL,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS command_usage (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id        TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      command         TEXT NOT NULL,
      used_at         INTEGER NOT NULL,
      success         INTEGER DEFAULT 1 NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS guild_activity (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id        TEXT NOT NULL,
      event_type      TEXT NOT NULL,
      data_json       TEXT,
      recorded_at     INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS message_stats (
      guild_id      TEXT NOT NULL,
      date          TEXT NOT NULL,
      total_messages INTEGER DEFAULT 0 NOT NULL,
      active_users  INTEGER DEFAULT 0 NOT NULL,
      PRIMARY KEY (guild_id, date),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS cache_entries (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      expires_at  INTEGER NOT NULL,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    )`,
    args: []
  },
  {
    sql: `CREATE INDEX IF NOT EXISTS idx_cache_entries_expires ON cache_entries(expires_at)`,
    args: []
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS cache_stats (
      key             TEXT PRIMARY KEY,
      hits            INTEGER NOT NULL DEFAULT 0,
      misses          INTEGER NOT NULL DEFAULT 0,
      evictions       INTEGER NOT NULL DEFAULT 0,
      size            INTEGER NOT NULL DEFAULT 0,
      updated_at      INTEGER NOT NULL
    )`,
    args: []
  },
  {
    sql: `CREATE INDEX IF NOT EXISTS idx_queue_state_updated ON queue_state(updated_at)`,
    args: []
  },
  {
    sql: `CREATE INDEX IF NOT EXISTS idx_economy_cooldowns_exp ON economy_cooldowns(expires_at)`,
    args: []
  },
  {
    sql: `CREATE INDEX IF NOT EXISTS idx_user_warnings_lookup ON user_warnings(guild_id, user_id, active)`,
    args: []
  },
  {
    sql: `CREATE INDEX IF NOT EXISTS idx_user_levels_lb ON user_levels(guild_id, xp DESC)`,
    args: []
  },
  {
    sql: `CREATE INDEX IF NOT EXISTS idx_tickets_lookup ON tickets(guild_id, status)`,
    args: []
  },
  {
    sql: `CREATE INDEX IF NOT EXISTS idx_infractions_user ON infractions(user_id, guild_id)`,
    args: []
  },
  {
    sql: `CREATE INDEX IF NOT EXISTS idx_audit_guild ON audit_logs(guild_id, created_at)`,
    args: []
  },
  {
    sql: `CREATE INDEX IF NOT EXISTS idx_command_usage_guild ON command_usage(guild_id, used_at)`,
    args: []
  },
  {
    sql: `CREATE INDEX IF NOT EXISTS idx_playlist_items_pos ON playlist_items(playlist_id, position)`,
    args: []
  },
  {
    sql: `CREATE INDEX IF NOT EXISTS idx_economy_txns_user ON economy_transactions(user_id, guild_id, created_at)`,
    args: []
  }
];

/**
 * Initialize database schema
 * Creates all necessary tables if they don't exist.
 * Schema mirrors migration 0004_consolidated_schema.js for startup safety.
 * @param {Object} db - Database instance
 */
async function initializeSchema(db) {
  const logger = (db && db.logger) || console;

  try {
    logger.info('[DatabaseHelper] Initializing database schema...');

    const perfLoggingEnabled = db.performanceLogger?.isEnabled();
    if (perfLoggingEnabled) {
      db.disablePerformanceLogging();
    }

    const schemaCheck = await db.query(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='guilds'
    `);

    if (schemaCheck && schemaCheck.length > 0) {
      const configCheck = await db.query(`
        SELECT 1 FROM pragma_table_info('guilds')
        WHERE name = 'config_json'
      `);

      if (configCheck && configCheck.length > 0) {
        logger.info('[DatabaseHelper] Schema already initialized, skipping...');
        if (perfLoggingEnabled) {
          db.enablePerformanceLogging();
        }
        return;
      }

      logger.info('[DatabaseHelper] Legacy schema detected, reinitializing...');
    }

    await db.batch(SCHEMA_DEFINITIONS);

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
