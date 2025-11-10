const { REST } = require("@discordjs/rest");
let Routes;
try {
    Routes = require("discord-api-types/v10").Routes;
} catch {
    Routes = require("@discordjs/rest").Routes;
}

const { token } = require("../config");

// daftar definisi slash command
const commands = [
    {
        name: "play",
        description: "Putar lagu dari query",
        options: [{
            name: "query",
            description: "judul/artist",
            type: 3,
            required: true
        }]
    },
    {
        name: "pause",
        description: "Jeda"
    },
    {
        name: "resume",
        description: "Lanjutkan"
    },
    {
        name: "stop",
        description: "Stop & clear queue"
    },
    {
        name: "skip",
        description: "Skip"
    },
    {
        name: "queue",
        description: "Lihat antrian"
    },
    {
        name: "volume",
        description: "Set volume 0-200",
        options: [{
            name: "value",
            description: "0-200",
            type: 4,
            required: true
        }]
    },
    {
        name: "loop",
        description: "Loop mode",
        options: [{
            name: "mode",
            description: "off|track|queue",
            type: 3,
            required: true
        }]
    },
    {
        name: "shuffle",
        description: "Acak queue"
    },
    {
        name: "remove",
        description: "Hapus index",
        options: [{
            name: "index",
            description: "index",
            type: 4,
            required: true
        }]
    },
    {
        name: "move",
        description: "Pindah index",
        options: [{
            name: "from",
            type: 4,
            required: true,
            description: "dari index"
        }, {
            name: "to",
            type: 4,
            required: true,
            description: "ke index"
        }]
    },
    {
        name: "clear",
        description: "Bersihkan queue (sisakan current)"
    },
    {
        name: "jump",
        description: "Lompat ke index",
        options: [{
            name: "index",
            type: 4,
            required: true,
            description: "index tujuan"
        }]
    },
    {
        name: "nowplaying",
        description: "Tampilkan Now Playing"
    },
    {
        name: "seek",
        description: "Loncat ke waktu (mm:ss)",
        options: [{
            name: "time",
            type: 3,
            required: true,
            description: "mm:ss atau detik"
        }]
    },
    {
        name: "filter",
        description: "Set filter",
        options: [{
            name: "preset",
            type: 3,
            required: true,
            description: "none|bassboost|nightcore|vaporwave|8d|karaoke|pitch:x|speed:x"
        }]
    },
    {
        name: "voteskip",
        description: "Ajukan vote skip"
    },
];

async function registerCommands(client) {
    try {
        const appId = client.application?.id || client.user?.id;
        if (!appId) throw new Error("Application ID belum siap.");

        const rest = new REST({ version: "10" }).setToken(token);

        await rest.put(Routes.applicationCommands(appId), { body: commands });
        console.log(`✅ Slash commands registered globally`);
    } catch (err) {
        console.error("❌ Gagal register slash commands:", err);
    }
}

module.exports = { registerCommands };