const { moveIdx } = require("../services/player");
const { sendMsg } = require("../services/utils");
/**
 * Memindahkan lagu dalam antrian dari posisi tertentu ke posisi lain.
 * Mendukung !move dan /move
 */
module.exports = {
    name: "move",
    description: "Memindahkan lagu dalam antrian dari posisi tertentu ke posisi lain.",
    usage: "move <from> <to>",
    example: "move 5 2",
    aliases: ["mv"],
    category: "music",
    async prefix(message, args) {
        await executeMove(message, args[0], args[1]);
    },
    async slash(interaction) {
        await executeMove(
            interaction,
            interaction.options.getInteger("from", true),
            interaction.options.getInteger("to", true)
        );
    },
};

/**
 * Fungsi utama memindahkan lagu dalam antrian
 */
async function executeMove(ctx, from, to) {
    try {
        if (!ctx.guild) return sendMsg(ctx, "⚠️ Tidak dalam server yang valid.");
        const guild = ctx.guild;
        await moveIdx(ctx, from, to);
        await sendMsg(ctx, "↔️ OK");
    } catch (err) {
        console.error("executeMove() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat memindahkan lagu dalam antrian.");
    }
}
