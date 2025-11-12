const { BaseCommand } = require('../../base/BaseCommand');

module.exports = class ResumeCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'resume',
            description: 'Melanjutkan pemutaran musik yang sedang dijeda.',
            category: 'music',
            usage: 'resume',
            aliases: ['resume'],
            cooldown: 2000
        });
    }

    async execute(message) {
        try {
            const guild = message.guild;
            if (!guild) return message.reply("⚠️ Tidak dalam server yang valid.");

            const { getState } = require("../../services/player");
            const s = getState(guild.id);

            if (!s.connection) return message.reply("⚠️ Bot tidak sedang di voice channel.");
            if (!s.player) return message.reply("⚠️ Tidak ada pemutar aktif.");

            // Coba lanjutkan pemutaran
            try {
                s.player.unpause();
            } catch (err) {
                console.error(`❌ Gagal melanjutkan pemutaran: ${err.message}`);
                return message.reply("❌ Gagal melanjutkan musik.");
            }

            await message.reply("▶️ Musik dilanjutkan.");
        } catch (err) {
            console.error("resume() error:", err);
            await message.reply("❌ Terjadi kesalahan saat melanjutkan musik.");
        }
    }
};
