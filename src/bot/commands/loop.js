const { toggleLoop } = require("../services/player");
const { sendMsg } = require("../services/utils");
/**
 * Toggle loop mode for queue or current track.
 * Supports !loop <mode> and /loop <mode>
 */
module.exports = {
    name: "loop",
    description: "Mengaktifkan atau menonaktifkan loop untuk antrian atau lagu saat ini.",
    usage: "loop <mode>",
    example: "loop queue",
    category: "music",
    async prefix(message, args) {
        await executeLoop(message, args[0]);
    },
    async slash(interaction) {
        await executeLoop(interaction, interaction.options.getString("mode", true));
    },
};

/**
 * Main function to toggle loop
 */
async function executeLoop(ctx, mode) {
    try {
        toggleLoop(ctx, mode);
        await sendMsg(ctx, "🔁 OK");
    } catch (err) {
        console.error("loop() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat mengubah mode loop.");
    }
}
