const { REST } = require("@discordjs/rest");
let Routes;
try {
    Routes = require("discord-api-types/v10").Routes;
} catch {
    Routes = require("@discordjs/rest").Routes;
}
const { system: logger } = require('../services/logging.service');

const CONFIG = require("../config");

const DEFINITIONS = {
    play: {
        name: "play",
        description: "Putar lagu dari query",
        options: [{ name: "query", description: "judul/artist", type: 3, required: true }]
    },
    pause: { name: "pause", description: "Jeda" },
    resume: { name: "resume", description: "Lanjutkan" },
    stop: { name: "stop", description: "Stop & clear queue" },
    skip: { name: "skip", description: "Skip" },
    queue: { name: "queue", description: "Lihat antrian" },
    volume: {
        name: "volume",
        description: "Set volume 0-200",
        options: [{ name: "value", description: "0-200", type: 4, required: true }]
    },
    loop: {
        name: "loop",
        description: "Loop mode",
        options: [{ name: "mode", description: "off|track|queue", type: 3, required: true }]
    },
    shuffle: { name: "shuffle", description: "Acak queue" },
    remove: {
        name: "remove",
        description: "Hapus index",
        options: [{ name: "index", description: "index", type: 4, required: true }]
    },
    move: {
        name: "move",
        description: "Pindah index",
        options: [
            { name: "from", type: 4, required: true, description: "dari index" },
            { name: "to", type: 4, required: true, description: "ke index" }
        ]
    },
    clear: { name: "clear", description: "Bersihkan queue (sisakan current)" },
    jump: {
        name: "jump",
        description: "Lompat ke index",
        options: [{ name: "index", type: 4, required: true, description: "index tujuan" }]
    },
    nowplaying: { name: "nowplaying", description: "Tampilkan Now Playing" },
    leave: { name: "leave", description: "Keluar dari voice channel" },
    status: { name: "status", description: "Status sistem musik" },
    seek: {
        name: "seek",
        description: "Loncat ke waktu (mm:ss)",
        options: [{ name: "time", type: 3, required: true, description: "mm:ss atau detik" }]
    },
    filter: {
        name: "filter",
        description: "Set filter",
        options: [{ name: "preset", type: 3, required: true, description: "none|bassboost|nightcore|vaporwave|8d|karaoke|pitch:x|speed:x" }]
    },
    voteskip: { name: "voteskip", description: "Ajukan vote skip" }
};

function buildSlashCommands(client) {
    const result = [];
    const all = client.commandHandler?.getAllCommands();
    if (!all) return result;
    for (const cmd of all.values()) {
        if (typeof cmd.slash === "function" && cmd.enabled !== false) {
            const def = DEFINITIONS[cmd.name];
            if (def) {
                result.push(def);
            } else {
                result.push({ name: cmd.name, description: cmd.description || "No description" });
            }
        }
    }
    return result;
}

async function registerCommands(client) {
    try {
        const appId = client.application?.id || client.user?.id;
        if (!appId) throw new Error("Application ID belum siap.");

        const rest = new REST({ version: "10" }).setToken(CONFIG.DISCORD.TOKEN);
        const commands = buildSlashCommands(client);

        if (CONFIG.DISCORD.GUILD_ID) {
            await rest.put(Routes.applicationGuildCommands(appId, CONFIG.DISCORD.GUILD_ID), { body: commands });
            logger.info(`✅ Slash commands registered for guild ${CONFIG.DISCORD.GUILD_ID}`);
        } else {
            await rest.put(Routes.applicationCommands(appId), { body: commands });
            logger.info(`✅ Slash commands registered globally`);
        }
    } catch (err) {
        logger.error("❌ Gagal register slash commands:", err);
    }
}

module.exports = { registerCommands };