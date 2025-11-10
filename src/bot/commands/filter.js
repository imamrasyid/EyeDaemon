const { setFilter } = require("../services/player");
const { sendMsg } = require("../services/utils");
/**
 * Menerapkan efek audio preset ke pemutar saat ini.
 * Mendukung !filter dan /filter
 */
module.exports = {
    name: "filter",
    description: "Menerapkan efek audio preset ke pemutar saat ini.",
    usage: "filter <preset>",
    example: "filter bassboost",
    aliases: ["fx"],
    category: "music",
    async prefix(message, args) {
        await executeFilter(message, args);
    },
    async slash(interaction) {
        await executeFilter(interaction);
    },
};

/**
 * Fungsi utama menerapkan filter
 */
async function executeFilter(ctx, args) {
    try {
        const preset = ctx.options?.getString?.("preset") ?? args?.[0];
        if (!preset) return sendMsg(ctx, "❓ Mohon berikan nama preset filter. Contoh: `!filter bassboost`");

        await setFilter(ctx, preset);
        await sendMsg(ctx, `🎚️ Filter **${preset}** diterapkan.`);
    } catch (err) {
        console.error("filter() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat menerapkan filter.");
    }
}
