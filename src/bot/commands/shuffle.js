const { shuffle } = require("../services/player");
const { sendMsg } = require("../services/utils");
/**
 * Mengacak urutan lagu dalam antrian.
 * Mendukung !shuffle dan /shuffle
 */
module.exports = {
    name: "shuffle",
    description: "Mengacak urutan lagu dalam antrian.",
    usage: "shuffle",
    example: "shuffle",
    aliases: ["acak"],
    category: "music",
    async prefix(message) {
        await executeShuffle(message);
    },
    async slash(interaction) {
        await executeShuffle(interaction);
    },
};

/**
 * Fungsi utama shuffle antrian
 */
async function executeShuffle(ctx) {
    try {
        const guild = ctx.guild;
        if (!guild) return sendMsg(ctx, "⚠️ Tidak dalam server yang valid.");
        const s = getState(guild.id);
        if (!s.connection) return sendMsg(ctx, "⚠️ Bot tidak sedang di voice channel.");
        if (!s.queue.length) return sendMsg(ctx, "⚠️ Antrian kosong, tidak ada yang bisa diacak.");

        shuffle(ctx);
        await sendMsg(ctx, "🔀 Antrian lagu telah diacak.");
    } catch (err) {
        console.error("shuffle() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat mengacak antrian.");
    }
}
