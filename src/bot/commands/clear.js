const { clearTail } = require("../services/player");
const { sendMsg } = require("../services/utils");

/**
 * Menghapus seluruh antrian lagu.
 * Mendukung !clear dan /clear
 */
module.exports = {
    name: "clear",
    description: "Menghapus seluruh antrian lagu.",
    usage: "clear",
    example: "clear",
    category: "music",

    async prefix(message) {
        await executeClear(message);
    },

    async slash(interaction) {
        await executeClear(interaction);
    },
};

/**
 * Fungsi utama menghapus antrian
 */
async function executeClear(ctx) {
    try {
        const guild = ctx.guild;
        if (!guild) return sendMsg(ctx, "⚠️ Tidak dalam server yang valid.");

        clearTail(ctx);

        await sendMsg(ctx, "🧹 Antrian telah dibersihkan.");
    } catch (err) {
        console.error("clear() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat membersihkan antrian.");
    }
}
