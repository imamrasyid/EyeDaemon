const { BaseCommand } = require('../../base/BaseCommand');
const { ensureConnection, play } = require("../../services/player");

module.exports = class PlayCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'play',
            description: 'Memutar atau menambahkan lagu ke antrian.',
            category: 'music',
            usage: 'play <query>',
            aliases: ['play'],
            cooldown: 2000
        });
    }

    async execute(message, args) {
        if (!args.length) return message.reply(`\`play <query>\``);
        await executePlay(message, args.join(" "));
    }

    async slash(interaction) {
        try {
            await interaction.deferReply();
            const query = interaction.options.getString("query", true);
            await executePlay(interaction, query);
            await interaction.editReply(`🎶 Menambahkan: \`${query}\``);
        } catch (err) {
            console.error("slash /play error:", err);
            if (interaction.deferred)
                await interaction.editReply("❌ Terjadi kesalahan saat memutar lagu.");
            else
                await interaction.reply({ content: "❌ Terjadi kesalahan saat memutar lagu.", flags: 64 });
        }
    }
};

async function executePlay(ctx, query) {
    try {
        const guild = ctx.guild;
        if (!guild) return ctx.reply("⚠️ Tidak dalam server yang valid.");
        await ensureConnection(ctx);
        await play(ctx, query);
    } catch (err) {
        console.error("play() error:", err);
        await ctx.reply("❌ Terjadi kesalahan saat memutar lagu.");
    }
}
