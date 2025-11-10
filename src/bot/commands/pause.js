const { pause } = require("../services/player");
const { sendMsg } = require("../services/utils");
/**
 * Menjeda pemutaran audio saat ini.
 * Mendukung !pause dan /pause
 */
module.exports = {
    name: "pause",
    description: "Menjeda pemutaran audio saat ini.",
    usage: "pause",
    example: "pause",
    aliases: ["hold"],
    category: "music",
    async prefix(message) {
        await executePause(message);
    },
    async slash(interaction) {
        await executePause(interaction);
    },
};

/**
 * Fungsi utama pause pemutaran
 */
async function executePause(ctx) {
    try {
        pause(ctx);
        await sendMsg(ctx, "⏸️");
    } catch (err) {
        console.error("pause() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat menjeda pemutaran.");
    }
}
