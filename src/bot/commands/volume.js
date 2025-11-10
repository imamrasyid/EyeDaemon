const { setVolume } = require("../services/player");
const { sendMsg } = require("../services/utils");
/**
 * Mengatur volume pemutar musik.
 * Mendukung !volume dan /volume
 */
module.exports = {
    name: "volume",
    description: "Mengatur volume pemutar musik.",
    usage: "volume <0-100>",
    example: "volume 75",
    aliases: ["vol"],
    category: "music",
    async prefix(message, args) {
        await executeVolume(message, args[0]);
    },
    async slash(interaction) {
        await executeVolume(interaction, interaction.options.getInteger("value", true));
    },
};

/**
 * Fungsi utama atur volume
 */
async function executeVolume(ctx, value) {
    try {
        const guild = ctx.guild;
        if (!guild) return sendMsg(ctx, "⚠️ Tidak dalam server yang valid.");

        const num = Number(value);
        if (isNaN(num) || num < 0 || num > 100) {
            return sendMsg(ctx, "⚠️ Volume harus angka antara 0-100.");
        }

        setVolume(ctx, num);
        await sendMsg(ctx, `🔊 Volume diatur ke ${num}%`);
    } catch (err) {
        console.error("executeVolume() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat mengatur volume.");
    }
}
