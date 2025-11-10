const { nowPlaying } = require("../services/player");
const { sendMsg } = require("../services/utils");
/**
 * Menampilkan informasi lagu yang sedang diputar.
 * Mendukung !nowplaying dan /nowplaying
 */
module.exports = {
    name: "nowplaying",
    description: "Menampilkan informasi lagu yang sedang diputar.",
    usage: "nowplaying",
    example: "nowplaying",
    category: "music",
    async prefix(message) {
        await executeNowPlaying(message);
    },
    async slash(interaction) {
        await executeNowPlaying(interaction);
    },
};

/**
 * Fungsi utama menampilkan informasi lagu yang sedang diputar
 */
async function executeNowPlaying(ctx) {
    try {
        await nowPlaying(ctx);
        if (ctx.isCommand && ctx.isCommand()) {
            await ctx.reply({
                content: "✅",
                flags: 64
            });
        }
    } catch (err) {
        console.error("nowplaying() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat menampilkan informasi lagu.");
    }
}
