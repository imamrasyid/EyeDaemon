const { BaseCommand } = require('../../base/BaseCommand');
const { moveIdx } = require("../../services/player");

module.exports = class MoveCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'move',
            description: 'Memindahkan lagu dalam antrian dari posisi tertentu ke posisi lain.',
            category: 'music',
            usage: 'move <from> <to>',
            aliases: ['mv'],
            cooldown: 2000
        });
    }

    async execute(message, args) {
        try {
            const guild = message.guild;
            if (!guild) return message.reply("⚠️ Tidak dalam server yang valid.");
            const from = parseInt(args[0]);
            const to = parseInt(args[1]);
            if (isNaN(from) || isNaN(to)) return message.reply("⚠️ Masukkan nomor antrian yang valid.");
            await moveIdx(message, from, to);
            await message.reply("↔️ OK");
        } catch (err) {
            console.error("executeMove() error:", err);
            await message.reply("❌ Terjadi kesalahan saat memindahkan lagu dalam antrian.");
        }
    }
};
