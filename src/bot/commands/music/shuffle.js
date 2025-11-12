const { BaseCommand } = require('../../base/BaseCommand');
module.exports = class ShuffleCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'shuffle',
            description: 'Mengacak urutan lagu dalam antrian.',
            category: 'music',
            usage: 'shuffle',
            aliases: ['acak'],
            cooldown: 2000
        });
    }
    async execute(message) {
        try {
            const guild = message.guild;
            if (!guild) return message.reply("⚠️ Tidak dalam server yang valid.");
            const { shuffle } = require("../../services/player");
            shuffle(message);
            await message.reply("🔀 Antrian lagu telah diacak.");
        } catch (err) {
            console.error("shuffle() error:", err);
            await message.reply("❌ Terjadi kesalahan saat mengacak antrian.");
        }
    }
};
