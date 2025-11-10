const { skip } = require("../services/player");
const { sendMsg } = require("../services/utils");
/**
 * Lewati lagu yang sedang diputar.
 * Mendukung !skip dan /skip
 */
module.exports = {
    name: "skip",
    description: "Lewati lagu yang sedang diputar.",
    usage: "skip",
    example: "skip",
    aliases: ["s", "next"],
    category: "music",
    async prefix(message) {
        await executeSkip(message);
    },
    async slash(interaction) {
        await executeSkip(interaction);
    },
};

/**
 * Fungsi utama skip lagu
 */
async function executeSkip(ctx) {
    try {
        const guild = ctx.guild;
        if (!guild) return sendMsg(ctx, "⚠️ Tidak dalam server yang valid.");
        await skip(ctx);
        await sendMsg(ctx, "⏭️ Lagu telah diskip.");
    } catch (err) {
        console.error("skip() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat menskip lagu.");
    }
}
