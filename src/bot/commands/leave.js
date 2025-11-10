const { getState } = require("../services/player");
const { sendMsg } = require("../services/utils");

/**
 * Keluar dari voice channel dengan aman.
 * Mendukung !leave dan /leave
 */
module.exports = {
    name: "leave",
    description: "Keluar dari voice channel dan hentikan pemutaran musik.",
    usage: "leave",
    example: "leave",
    category: "music",

    async prefix(message) {
        await executeLeave(message);
    },

    async slash(interaction) {
        await executeLeave(interaction);
    },
};

/**
 * Fungsi utama keluar voice channel
 */
async function executeLeave(ctx) {
    try {
        const guild = ctx.guild;
        if (!guild) return sendMsg(ctx, "⚠️ Tidak dalam server yang valid.");

        const s = getState(guild.id);
        if (!s.connection) return sendMsg(ctx, "⚠️ Bot tidak sedang di voice channel.");

        // Coba putuskan koneksi
        try {
            s.player.stop();
            s.connection.destroy();
            s.connection = null;
        } catch (err) {
            console.error(`❌ Gagal keluar voice channel: ${err.message}`);
        }

        // Reset state guild agar tidak nyangkut
        s.queue = [];
        s.now = null;

        await sendMsg(ctx, "👋 Bot telah keluar dari voice channel dan menghentikan semua musik.");
    } catch (err) {
        console.error("leave() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat keluar dari voice channel.");
    }
}
