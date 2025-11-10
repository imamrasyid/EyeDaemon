const { showQueue } = require("../services/player");
const { sendMsg } = require("../services/utils");
/**
 * Menampilkan daftar lagu yang sedang mengantar.
 * Mendukung !queue dan /queue
 */
module.exports = {
    name: "queue",
    description: "Menampilkan daftar lagu yang sedang mengantar.",
    usage: "queue",
    example: "queue",
    category: "music",
    async prefix(message) {
        await executeQueue(message);
    },
    async slash(interaction) {
        await executeQueue(interaction);
    },
};

/**
 * Fungsi utama menampilkan queue
 */
async function executeQueue(ctx) {
    try {
        await showQueue(ctx);
        if (ctx.type && ctx.type === 2) {
            // Slash interaction
            await ctx.reply({
                content: "✅ Queue dikirim.",
                flags: 64
            });
        }
    } catch (err) {
        console.error("executeQueue() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat menampilkan queue.");
    }
}
