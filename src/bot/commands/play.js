const { ensureConnection, play } = require("../services/player");
const { sendMsg } = require("../services/utils");

module.exports = {
    name: "play",
    description: "Memutar atau menambahkan lagu ke antrian.",
    usage: "play <query>",
    example: "play Rick Astley Never Gonna Give You Up",
    category: "music",

    async prefix(message, args) {
        if (!args.length) return sendMsg(message, `\`${prefix}play <query>\``);
        await executePlay(message, args.join(" "));
    },

    async slash(interaction) {
        try {
            await interaction.deferReply(); // ✅ penting: acknowledge dulu ke Discord
            const query = interaction.options.getString("query", true);
            await executePlay(interaction, query);

            // ubah pesan awal setelah selesai
            await interaction.editReply(`🎶 Menambahkan: \`${query}\``);
        } catch (err) {
            console.error("slash /play error:", err);
            if (interaction.deferred)
                await interaction.editReply("❌ Terjadi kesalahan saat memutar lagu.");
            else
                await interaction.reply({ content: "❌ Terjadi kesalahan saat memutar lagu.", flags: 64 });
        }
    },
};

async function executePlay(ctx, query) {
    try {
        const guild = ctx.guild;
        if (!guild) return sendMsg(ctx, "⚠️ Tidak dalam server yang valid.");

        await ensureConnection(ctx);
        await play(ctx, query);
    } catch (err) {
        console.error("play() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat memutar lagu.");
    }
}
