const { getState } = require("../services/player");
const { sendMsg } = require("../services/utils");

/**
 * Melanjutkan pemutaran musik yang sedang dijeda.
 * Mendukung !resume dan /resume
 */
module.exports = {
    name: "resume",
    description: "Melanjutkan pemutaran musik yang sedang dijeda.",
    usage: "resume",
    example: "resume",
    category: "music",
    async prefix(message) {
        await executeResume(message);
    },
    async slash(interaction) {
        await executeResume(interaction);
    },
};

/**
 * Fungsi utama melanjutkan pemutaran
 */
async function executeResume(ctx) {
    try {
        const guild = ctx.guild;
        if (!guild) return sendMsg(ctx, "⚠️ Tidak dalam server yang valid.");

        const s = getState(guild.id);
        if (!s.connection) return sendMsg(ctx, "⚠️ Bot tidak sedang di voice channel.");
        if (!s.player) return sendMsg(ctx, "⚠️ Tidak ada pemutar aktif.");

        // Coba lanjutkan pemutaran
        try {
            s.player.unpause();
        } catch (err) {
            console.error(`❌ Gagal melanjutkan pemutaran: ${err.message}`);
            return sendMsg(ctx, "❌ Gagal melanjutkan musik.");
        }

        await sendMsg(ctx, "▶️ Musik dilanjutkan.");
    } catch (err) {
        console.error("resume() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat melanjutkan musik.");
    }
}
