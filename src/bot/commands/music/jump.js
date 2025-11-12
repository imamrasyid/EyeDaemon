const { BaseCommand } = require('../../base/BaseCommand');

module.exports = class JumpCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'jump',
            description: 'Memutar lagu pada posisi tertentu di antrian.',
            category: 'music',
            usage: 'jump <index>',
            aliases: ['jmp'],
            cooldown: 2000
        });
    }

    async execute(message, args) {
        try {
            const guild = message.guild;
            if (!guild) return message.reply("⚠️ Tidak dalam server yang valid.");

            const { getState } = require("../../services/player");
            const s = getState(guild.id);
            const index = Number(args[0]);

            if (!s.queue[index]) return message.reply("⚠️ Index tidak valid.");

            const [t] = s.queue.splice(index, 1);
            s.queue.unshift(t);
            s.player.stop();

            await message.reply(`⏩ Lompat ke: **${t.title}**`);
        } catch (err) {
            console.error("jump() error:", err);
            await message.reply("❌ Terjadi kesalahan saat melompat ke lagu.");
        }
    }
};
