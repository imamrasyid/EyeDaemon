const { getState } = require("../services/player");
const { sendMsg } = require("../services/utils");

/**
 * Lompat ke lagu pada posisi tertentu di antrian.
 * Mendukung !jump <index> dan /jump index:<index>
 */
module.exports = {
    name: "jump",
    description: "Memutar lagu pada posisi tertentu di antrian.",
    usage: "jump <index>",
    example: "jump 3",
    aliases: ["jmp"],
    category: "music",
    async prefix(message, args) {
        await executeJump(message, Number(args[0]));
    },
    async slash(interaction) {
        const idx = interaction.options.getInteger("index", true);
        await executeJump(interaction, idx);
    },
};

/**
 * Fungsi utama lompat ke lagu
 */
async function executeJump(ctx, index) {
    try {
        const guild = ctx.guild;
        if (!guild) return sendMsg(ctx, "⚠️ Tidak dalam server yang valid.");

        const s = getState(guild.id);
        if (!s.queue[index]) return sendMsg(ctx, "⚠️ Index tidak valid.");

        const [t] = s.queue.splice(index, 1);
        s.queue.unshift(t);
        s.player.stop();

        await sendMsg(ctx, `⏩ Lompat ke: **${t.title}**`);
    } catch (err) {
        console.error("jump() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat melompat ke lagu.");
    }
}
