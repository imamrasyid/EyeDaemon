const { BaseCommand } = require('../../base/BaseCommand');

module.exports = class PauseCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'pause',
            description: 'Menjeda pemutaran audio saat ini.',
            category: 'music',
            usage: 'pause',
            aliases: ['hold'],
            cooldown: 2000
        });
    }

    async execute(message) {
        try {
            const { pause } = require("../../services/player");
            pause(message);
            await message.reply("⏸️");
        } catch (err) {
            console.error("pause() error:", err);
            await message.reply("❌ Terjadi kesalahan saat menjeda pemutaran.");
        }
    }
};
