const { BaseCommand } = require('../../base/BaseCommand');
const { setVolume } = require("../../services/player");

module.exports = class VolumeCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'volume',
            description: 'Mengatur volume pemutar musik.',
            category: 'music',
            usage: 'volume <0-100>',
            aliases: ['vol'],
            cooldown: 2000
        });
    }

    async execute(message, args) {
        try {
            const guild = message.guild;
            if (!guild) return message.reply("⚠️ Tidak dalam server yang valid.");

            const value = args[0];
            const num = Number(value);
            if (isNaN(num) || num < 0 || num > 100) {
                return message.reply("⚠️ Volume harus angka antara 0-100.");
            }

            setVolume(message, num);
            await message.reply(`🔊 Volume diatur ke ${num}%`);
        } catch (err) {
            console.error("volume() error:", err);
            await message.reply("❌ Terjadi kesalahan saat mengatur volume.");
        }
    }
};
