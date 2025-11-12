const { BaseCommand } = require('../../base/BaseCommand');

module.exports = class LoopCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'loop',
            description: 'Mengaktifkan atau menonaktifkan loop untuk antrian atau lagu saat ini.',
            category: 'music',
            usage: 'loop <mode>',
            aliases: ['loop'],
            cooldown: 2000
        });
    }

    async execute(message, args) {
        try {
            const mode = args[0];
            if (!mode) return message.reply("⚠️ Mohon berikan mode loop (queue/track).");

            const { toggleLoop } = require("../../services/player");
            toggleLoop(message, mode);
            await message.reply("🔁 OK");
        } catch (err) {
            console.error("loop() error:", err);
            await message.reply("❌ Terjadi kesalahan saat mengubah mode loop.");
        }
    }
};
