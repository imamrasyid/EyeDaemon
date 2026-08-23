'use strict';

/**
 * Migration 0001: Initial Schema (Consolidated Canonical Schema)
 *
 * Domain-organized, centralized schema for EyeDaemon.
 * Supports SQLite local file and remote Turso LibSQL database.
 */

const up = async (db) => {
  try {
    await db.query('PRAGMA foreign_keys = OFF;');
  } catch {}

  // ── 1. Core: identity & membership ───────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS guilds (
      guild_id      TEXT PRIMARY KEY,
      name          TEXT,
      config_json   TEXT DEFAULT '{}' NOT NULL,
      prefix        TEXT DEFAULT '!',
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    ) WITHOUT ROWID;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id       TEXT PRIMARY KEY,
      username      TEXT,
      display_name  TEXT,
      avatar_url    TEXT,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    ) WITHOUT ROWID;
  `);

  // ── 2. Economy ────────────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS economy_accounts (
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
    ) WITHOUT ROWID;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS economy_transactions (
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
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS economy_cooldowns (
      user_id       TEXT NOT NULL,
      guild_id      TEXT NOT NULL,
      action        TEXT NOT NULL,
      expires_at    INTEGER NOT NULL,
      PRIMARY KEY (user_id, guild_id, action),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    ) WITHOUT ROWID;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS shop_items (
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
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_inventories (
      user_id           TEXT NOT NULL,
      guild_id          TEXT NOT NULL,
      item_id           TEXT NOT NULL,
      quantity          INTEGER NOT NULL DEFAULT 1,
      created_at        INTEGER NOT NULL,
      PRIMARY KEY (user_id, guild_id, item_id),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE
    ) WITHOUT ROWID;
  `);

  // ── 3. Leveling ───────────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_levels (
      user_id           TEXT NOT NULL,
      guild_id          TEXT NOT NULL,
      xp                INTEGER NOT NULL DEFAULT 0,
      level             INTEGER NOT NULL DEFAULT 0,
      last_message_at   INTEGER,
      created_at        INTEGER NOT NULL,
      updated_at        INTEGER NOT NULL,
      PRIMARY KEY (user_id, guild_id),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    ) WITHOUT ROWID;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS level_rewards (
      guild_id      TEXT NOT NULL,
      level         INTEGER NOT NULL,
      reward_type   TEXT NOT NULL,
      data_json     TEXT,
      created_at    INTEGER NOT NULL,
      PRIMARY KEY (guild_id, level, reward_type),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    ) WITHOUT ROWID;
  `);

  // ── 4. Moderation ─────────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_warnings (
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
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS infractions (
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
    );
  `);

  // ── 5. Audit ──────────────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id        TEXT NOT NULL,
      actor_id        TEXT,
      action          TEXT NOT NULL,
      category        TEXT,
      target_id       TEXT,
      details_json    TEXT,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );
  `);

  // ── 6. Tickets ────────────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS ticket_counters (
      guild_id      TEXT PRIMARY KEY,
      counter       INTEGER NOT NULL DEFAULT 0,
      last_number   INTEGER NOT NULL DEFAULT 0,
      updated_at    INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    ) WITHOUT ROWID;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id              TEXT PRIMARY KEY,
      guild_id        TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      channel_id      TEXT NOT NULL,
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
    );
  `);

  // ── 7. Music ──────────────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS playlists (
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
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS playlist_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id     TEXT NOT NULL,
      position        INTEGER NOT NULL,
      title           TEXT NOT NULL,
      url             TEXT NOT NULL,
      duration        INTEGER,
      requested_by    TEXT NOT NULL,
      added_at        INTEGER NOT NULL,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS queue_state (
      guild_id      TEXT PRIMARY KEY,
      data_json     TEXT NOT NULL,
      updated_at    INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    ) WITHOUT ROWID;
  `);

  // ── 8. Utility ────────────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS reaction_roles (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id    TEXT NOT NULL,
      channel_id    TEXT NOT NULL,
      guild_id      TEXT NOT NULL,
      emoji         TEXT NOT NULL,
      role_id       TEXT NOT NULL,
      description   TEXT,
      created_at    INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS auto_roles (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id      TEXT NOT NULL,
      role_id       TEXT NOT NULL,
      type          TEXT NOT NULL DEFAULT 'join',
      delay_minutes INTEGER DEFAULT 0,
      created_at    INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS event_logs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id        TEXT NOT NULL,
      event_type      TEXT NOT NULL,
      user_id         TEXT,
      channel_id      TEXT,
      data_json       TEXT,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );
  `);

  // ── 9. Security ───────────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS guild_whitelist (
      guild_id    TEXT NOT NULL,
      type        TEXT NOT NULL,
      target_id   TEXT NOT NULL,
      PRIMARY KEY (guild_id, type, target_id),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    ) WITHOUT ROWID;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS guild_blacklist (
      guild_id    TEXT NOT NULL,
      type        TEXT NOT NULL,
      target_id   TEXT NOT NULL,
      PRIMARY KEY (guild_id, type, target_id),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    ) WITHOUT ROWID;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS feature_toggles (
      guild_id    TEXT NOT NULL,
      feature     TEXT NOT NULL,
      enabled     INTEGER DEFAULT 1 NOT NULL,
      updated_at  INTEGER NOT NULL,
      PRIMARY KEY (guild_id, feature),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    ) WITHOUT ROWID;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS auto_mod_rules (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id        TEXT NOT NULL,
      name            TEXT NOT NULL,
      event           TEXT NOT NULL,
      trigger_json    TEXT NOT NULL,
      action_json     TEXT NOT NULL,
      enabled         INTEGER DEFAULT 1 NOT NULL,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );
  `);

  // ── 10. Analytics ────────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS command_usage (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id        TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      command         TEXT NOT NULL,
      used_at         INTEGER NOT NULL,
      success         INTEGER DEFAULT 1 NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS guild_activity (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id        TEXT NOT NULL,
      event_type      TEXT NOT NULL,
      data_json       TEXT,
      recorded_at     INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS message_stats (
      guild_id      TEXT NOT NULL,
      date          TEXT NOT NULL,
      total_messages INTEGER DEFAULT 0 NOT NULL,
      active_users  INTEGER DEFAULT 0 NOT NULL,
      PRIMARY KEY (guild_id, date),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    ) WITHOUT ROWID;
  `);

  // ── 11. Infrastructure ────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS cache_entries (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      expires_at  INTEGER NOT NULL,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    ) WITHOUT ROWID;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS cache_stats (
      key             TEXT PRIMARY KEY,
      hits            INTEGER NOT NULL DEFAULT 0,
      misses          INTEGER NOT NULL DEFAULT 0,
      evictions       INTEGER NOT NULL DEFAULT 0,
      size            INTEGER NOT NULL DEFAULT 0,
      updated_at      INTEGER NOT NULL
    ) WITHOUT ROWID;
  `);

  // ── 12. Indexes ───────────────────────────────────────────────────────────
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_cache_entries_expires ON cache_entries(expires_at);',
    'CREATE INDEX IF NOT EXISTS idx_queue_state_updated ON queue_state(updated_at);',
    'CREATE INDEX IF NOT EXISTS idx_economy_cooldowns_exp ON economy_cooldowns(expires_at);',
    'CREATE INDEX IF NOT EXISTS idx_user_warnings_lookup ON user_warnings(guild_id, user_id, active);',
    'CREATE INDEX IF NOT EXISTS idx_user_levels_lb ON user_levels(guild_id, xp DESC);',
    'CREATE INDEX IF NOT EXISTS idx_tickets_lookup ON tickets(guild_id, status);',
    'CREATE INDEX IF NOT EXISTS idx_infractions_user ON infractions(user_id, guild_id);',
    'CREATE INDEX IF NOT EXISTS idx_audit_guild ON audit_logs(guild_id, created_at);',
    'CREATE INDEX IF NOT EXISTS idx_command_usage_guild ON command_usage(guild_id, used_at);',
    'CREATE INDEX IF NOT EXISTS idx_playlist_items_pos ON playlist_items(playlist_id, position);',
    'CREATE INDEX IF NOT EXISTS idx_economy_txns_user ON economy_transactions(user_id, guild_id, created_at);'
  ];

  for (const indexSql of indexes) {
    await db.query(indexSql);
  }

  try {
    await db.query('PRAGMA foreign_keys = ON;');
  } catch {}
};

const down = async (db) => {
  const tables = [
    'message_stats',
    'guild_activity',
    'command_usage',
    'auto_mod_rules',
    'feature_toggles',
    'guild_blacklist',
    'guild_whitelist',
    'event_logs',
    'auto_roles',
    'reaction_roles',
    'queue_state',
    'playlist_items',
    'playlists',
    'tickets',
    'ticket_counters',
    'audit_logs',
    'infractions',
    'user_warnings',
    'level_rewards',
    'user_levels',
    'user_inventories',
    'shop_items',
    'economy_cooldowns',
    'economy_transactions',
    'economy_accounts',
    'user_profiles',
    'guilds',
    'cache_stats'
  ];

  try {
    await db.query('PRAGMA foreign_keys = OFF;');
  } catch {}

  for (const table of tables) {
    try {
      await db.query(`DROP TABLE IF EXISTS ${table};`);
    } catch {}
  }

  const dropIndexes = [
    'DROP INDEX IF EXISTS idx_infractions_user;',
    'DROP INDEX IF EXISTS idx_audit_guild;',
    'DROP INDEX IF EXISTS idx_command_usage_guild;',
    'DROP INDEX IF EXISTS idx_playlist_items_pos;',
    'DROP INDEX IF EXISTS idx_economy_txns_user;'
  ];

  for (const dropIndexSql of dropIndexes) {
    try {
      await db.query(dropIndexSql);
    } catch {}
  }

  try {
    await db.query('PRAGMA foreign_keys = ON;');
  } catch {}
};

module.exports = {
  name: '0001_initial_schema',
  up,
  down
};
