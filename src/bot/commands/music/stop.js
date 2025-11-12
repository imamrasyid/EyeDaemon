const { BaseCommand } = require('../../base/BaseCommand');

module.exports = class StopCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'stop',
            description: 'Menghentikan pemutaran musik dan membersihkan antrian.',
            category: 'music',
            usage: 'stop',
            aliases: ['st'],
            cooldown: 2000
        });
    }

    async execute(message) {
        try {
            const guild = message.guild;
            if (!guild) return message.reply("⚠️ Tidak dalam server yang valid.");

            const { getState } = require("../../services/player");
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

            await message.reply("⏹️ Pemutaran dihentikan dan antrian dibersihkan.");
        } catch (err) {
            console.error("stop() error:", err);
            await message.reply("❌ Terjadi kesalahan saat menghentikan pemutaran.");
        }
    }

    async slash(interaction) {
        try {
            const guild = interaction.guild;
            if (!guild) return interaction.reply("⚠️ Tidak dalam server yang valid.");

            const { getState } = require("../../services/player");
            const s = getState(guild.id);

            if (s.player && s.player.stop) {
                try { s.player.stop(); } catch (err) { console.error(`❌ Gagal hentikan player: ${err.message}`); }
            }

            s.queue = [];
            s.now = null;

            await interaction.reply("⏹️ Pemutaran dihentikan dan antrian dibersihkan.");
        } catch (err) {
            console.error("stop() error:", err);
            await interaction.reply("❌ Terjadi kesalahan saat menghentikan pemutaran.");
        }
    }
};
