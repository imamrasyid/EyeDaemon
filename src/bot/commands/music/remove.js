const { BaseCommand } = require('../../base/BaseCommand');

module.exports = class RemoveCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'remove',
            description: 'Menghapus lagu dari antrian berdasarkan nomor urut.',
            category: 'music',
            usage: 'remove <index>',
            aliases: ['remove'],
            cooldown: 2000
        });
    }

    async execute(message, args) {
        try {
            const guild = message.guild;
            if (!guild) return message.reply("⚠️ Tidak dalam server yang valid.");

            const index = parseInt(args[0], 10);
            if (isNaN(index) || index < 1) return message.reply("⚠️ Index harus angka positif.");

            const { getState } = require("../../services/player");
            const s = getState(guild.id);
            if (!s.queue.length) return message.reply("⚠️ Antrian kosong.");
            if (index > s.queue.length) return message.reply(`⚠️ Index melebihi jumlah lagu dalam antrian (${s.queue.length}).`);

            const removed = s.queue.splice(index - 1, 1)[0];
            await message.reply(`🗑️ Berhasil menghapus **${removed.title}** dari antrian.`);
        } catch (err) {
            console.error("remove() error:", err);
            await message.reply("❌ Terjadi kesalahan saat menghapus lagu dari antrian.");
        }
    }
};
