const { getState } = require("../services/player");
const { sendMsg } = require("../services/utils");

/**
 * Menghentikan pemutaran musik dan membersihkan antrian.
 * Mendukung !stop dan /stop
 */
module.exports = {
    name: "stop",
    description: "Menghentikan pemutaran musik dan membersihkan antrian.",
    usage: "stop",
    example: "stop",
    aliases: ["st"],
    category: "music",
    async prefix(message) {
        await executeStop(message);
    },
    async slash(interaction) {
        await executeStop(interaction);
    },
};

/**
 * Fungsi utama hentikan pemutaran dan bersihkan antrian
 */
async function executeStop(ctx) {
    try {
        const guild = ctx.guild;
        if (!guild) return sendMsg(ctx, "⚠️ Tidak dalam server yang valid.");

        const s = getState(guild.id);

        // Hentikan player jika sedang bermain
        if (s.player && s.player.stop) {
            try {
                s.player.stop();
            } catch (err) {
                console.error(`❌ Gagal hentikan player: ${err.message}`);
            }
        }

        // Bersihkan antrian dan reset state
        s.queue = [];
        s.now = null;

        await sendMsg(ctx, "⏹️ Pemutaran dihentikan dan antrian dibersihkan.");
    } catch (err) {
        console.error("executeStop() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat menghentikan pemutaran.");
    }
}
