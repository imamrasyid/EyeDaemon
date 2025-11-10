const { getState } = require("../services/player");
const { sendMsg } = require("../services/utils");

/**
 * Menghapus lagu dari antrian berdasarkan nomor urut.
 * Mendukung !remove <index> dan /remove index:<index>
 */
module.exports = {
    name: "remove",
    description: "Menghapus lagu dari antrian berdasarkan nomor urut.",
    usage: "remove <index>",
    example: "remove 3",
    category: "music",
    async prefix(message, args) {
        await executeRemove(message, args[0]);
    },
    async slash(interaction) {
        await executeRemove(interaction, interaction.options.getInteger("index", true));
    },
};

/**
 * Fungsi utama hapus lagu dari antrian
 * @param {Message|CommandInteraction} ctx
 * @param {string|number} indexInput
 */
async function executeRemove(ctx, indexInput) {
    try {
        const guild = ctx.guild;
        if (!guild) return sendMsg(ctx, "⚠️ Tidak dalam server yang valid.");

        const index = parseInt(indexInput, 10);
        if (isNaN(index) || index < 1) return sendMsg(ctx, "⚠️ Index harus angka positif.");

        const s = getState(guild.id);
        if (!s.queue.length) return sendMsg(ctx, "⚠️ Antrian kosong.");

        if (index > s.queue.length) return sendMsg(ctx, `⚠️ Index melebihi jumlah lagu dalam antrian (${s.queue.length}).`);

        const removed = s.queue.splice(index - 1, 1)[0];
        await sendMsg(ctx, `🗑️ Berhasil menghapus **${removed.title}** dari antrian.`);
    } catch (err) {
        console.error("remove() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat menghapus lagu dari antrian.");
    }
}
