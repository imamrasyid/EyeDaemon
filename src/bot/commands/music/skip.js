const { BaseCommand } = require('../../base/BaseCommand');

module.exports = class SkipCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'skip',
            description: 'Lewati lagu yang sedang diputar.',
            category: 'music',
            usage: 'skip',
            aliases: ['s', 'next'],
            cooldown: 2000
        });
    }

    async execute(message) {
        try {
            const guild = message.guild;
            if (!guild) return message.reply("⚠️ Tidak dalam server yang valid.");
            const { skip } = require("../../services/player");
            skip(message);
            await message.reply("⏭️ Lagu telah diskip.");
        } catch (err) {
            console.error("skip() error:", err);
            await message.reply("❌ Terjadi kesalahan saat menskip lagu.");
        }
    }
};
