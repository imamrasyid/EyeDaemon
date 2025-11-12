const { BaseCommand } = require('../../base/BaseCommand');

module.exports = class ClearCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'clear',
            description: 'Menghapus seluruh antrian lagu.',
            category: 'music',
            usage: 'clear',
            aliases: ['clear'],
            cooldown: 2000
        });
    }

    async execute(message) {
        try {
            const guild = message.guild;
            if (!guild) return message.reply("⚠️ Tidak dalam server yang valid.");

            const { clearTail } = require("../../services/player");
            clearTail(message);

            await message.reply("🧹 Antrian telah dibersihkan.");
        } catch (err) {
            console.error("clear() error:", err);
            await message.reply("❌ Terjadi kesalahan saat membersihkan antrian.");
        }
    }
};
