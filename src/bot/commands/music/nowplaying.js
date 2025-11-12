const { BaseCommand } = require('../../base/BaseCommand');
const { nowPlaying } = require("../../services/player");
const { sendMsg } = require("../../services/utils");

module.exports = class NowPlayingCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'nowplaying',
            description: 'Menampilkan informasi lagu yang sedang diputar.',
            category: 'music',
            usage: 'nowplaying',
            aliases: ['nowplaying', 'np'],
            cooldown: 2000
        });
    }

    async execute(message) {
        try {
            await nowPlaying(message);
            await message.react("✅");
        } catch (err) {
            console.error("nowplaying() error:", err);
            await message.reply("❌ Terjadi kesalahan saat menampilkan informasi lagu.");
        }
    }
};
