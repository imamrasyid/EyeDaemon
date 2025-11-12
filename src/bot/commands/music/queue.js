const { BaseCommand } = require('../../base/BaseCommand');
const { showQueue } = require("../../services/player");

module.exports = class QueueCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'queue',
            description: 'Menampilkan daftar lagu yang sedang mengantar.',
            category: 'music',
            usage: 'queue',
            aliases: ['queue'],
            cooldown: 2000
        });
    }

    async execute(message) {
        try {
            const guild = message.guild;
            if (!guild) return message.reply("⚠️ Tidak dalam server yang valid.");
            await showQueue(message);
            await message.reply("✅ Queue dikirim.");
        } catch (err) {
            console.error("queue() error:", err);
            await message.reply("❌ Terjadi kesalahan saat menampilkan queue.");
        }
    }
};
