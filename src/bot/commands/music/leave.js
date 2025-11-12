const { BaseCommand } = require('../../base/BaseCommand');

module.exports = class LeaveCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'leave',
            description: 'Keluar dari voice channel dan hentikan pemutaran musik.',
            category: 'music',
            usage: 'leave',
            aliases: ['leave'],
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

            // Coba putuskan koneksi
            try {
                s.player.stop();
                s.connection.destroy();
                s.connection = null;
            } catch (err) {
                console.error(`❌ Gagal keluar voice channel: ${err.message}`);
            }

            // Reset state guild agar tidak nyangkut
            s.queue = [];
            s.now = null;

            await message.reply("👋 Bot telah keluar dari voice channel dan menghentikan semua musik.");
        } catch (err) {
            console.error("leave() error:", err);
            await message.reply("❌ Terjadi kesalahan saat keluar dari voice channel.");
        }
    }
};
