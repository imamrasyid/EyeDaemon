const Database = require("better-sqlite3");
const path = require("path");
const { dbPath } = require("../config");

const db = new Database(path.resolve(dbPath));
db.exec(`CREATE TABLE IF NOT EXISTS queues (
  guild_id TEXT PRIMARY KEY,
  queue_json TEXT NOT NULL,
  now_json TEXT
);`);

function saveQueue(gid, state) {
    const q = JSON.stringify(state.queue || []);
    const n = JSON.stringify(state.now || null);
    db.prepare("INSERT OR REPLACE INTO queues (guild_id,queue_json,now_json) VALUES (?,?,?)").run(gid, q, n);
}

function loadQueue(gid) {
    const row = db.prepare("SELECT queue_json, now_json FROM queues WHERE guild_id=?").get(gid);
    if (!row) return null;
    return { queue: JSON.parse(row.queue_json), now: JSON.parse(row.now_json) };
}

function deleteQueue(gid) {
    db.prepare("DELETE FROM queues WHERE guild_id=?").run(gid);
}

function listAllGuilds() {
    return db.prepare("SELECT guild_id FROM queues").all().map(r => r.guild_id);
}

// Backward-compat (kalau ada yang masih manggil allGuilds)
const allGuilds = listAllGuilds;

module.exports = { saveQueue, loadQueue, deleteQueue, listAllGuilds, allGuilds };
