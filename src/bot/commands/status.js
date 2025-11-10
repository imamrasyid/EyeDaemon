const { getState } = require("../services/player");
const { listAllGuilds } = require("../services/storage");
const { EmbedBuilder } = require("discord.js");
const os = require("os");
const { sendMsg } = require("../services/utils");

/**
 * Menampilkan statistik global dan per guild bot musik.
 * Mendukung !status dan /status
 */
module.exports = {
    name: "status",
    description: "Menampilkan statistik global dan per guild bot musik.",
    usage: "status",
    example: "status",
    aliases: ["stat", "info"],
    category: "info",

    async prefix(message) {
        await executeStatus(message);
    },

    async slash(interaction) {
        await executeStatus(interaction);
    },
};

/**
 * Fungsi utama menampilkan status
 */
async function executeStatus(ctx) {
    try {
        const client = ctx.client || ctx.guild?.client;
        if (!client) return sendMsg(ctx, "⚠️ Tidak dapat mengakses client bot.");

        const guildCount = client.guilds.cache.size;
        const gids = listAllGuilds();

        let activeGuilds = 0;
        let totalTracks = 0;
        let playingGuilds = 0;
        const details = [];

        for (const gid of gids) {
            const g = client.guilds.cache.get(gid);
            const s = getState(gid);
            const queueSize = s.queue?.length || 0;
            totalTracks += queueSize;

            const status = s.now ? "▶️ Playing" : (queueSize ? "⏸️ Idle" : "🔕 Empty");
            if (queueSize > 0) activeGuilds++;
            if (s.now) playingGuilds++;

            details.push(
                `**${g?.name || gid}**\n` +
                `• Lagu: ${queueSize}\n` +
                `• Status: ${status}\n` +
                (s.now ? `• Now: [${s.now.title.slice(0, 40)}](${s.now.url})\n` : "") +
                (s.loop && s.loop !== "off" ? `• Loop: ${s.loop}\n` : "") +
                (s.filter && s.filter !== "none" ? `• Filter: ${s.filter}\n` : "")
            );
        }

        const uptimeSec = Math.floor(process.uptime());
        const uptimeH = Math.floor(uptimeSec / 3600);
        const uptimeM = Math.floor((uptimeSec % 3600) / 60);

        const mem = process.memoryUsage();
        const totalMemMb = Math.round(mem.rss / 1024 / 1024);
        const freeMemMb = Math.round(os.freemem() / 1024 / 1024);

        const embed = new EmbedBuilder()
            .setColor(0x00a8ff)
            .setTitle("📊 Status Sistem Musik")
            .addFields(
                { name: "🌐 Total Guild", value: `${guildCount}`, inline: true },
                { name: "🎵 Guild Aktif", value: `${activeGuilds}`, inline: true },
                { name: "▶️ Guild Memutar Musik", value: `${playingGuilds}`, inline: true },
                { name: "🎶 Total Lagu di Antrian", value: `${totalTracks}`, inline: true },
                { name: "🧠 Memory", value: `${totalMemMb} MB (Free ${freeMemMb} MB)`, inline: true },
                { name: "⏱️ Uptime", value: `${uptimeH}h ${uptimeM}m`, inline: true },
            )
            .setFooter({ text: `Dijalankan di host ${os.hostname()} | ${new Date().toLocaleString()}` });

        if (details.length > 0)
            embed.addFields({ name: "📂 Detail Per Guild", value: details.join("\n\n").slice(0, 3900) });

        await sendMsg(ctx, { embeds: [embed] });
    } catch (err) {
        console.error("status() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat menampilkan status.");
    }
}
