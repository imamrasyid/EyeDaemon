const { BaseCommand } = require('../../base/BaseCommand');

const votes = new Map(); // gid -> Set(userId)

module.exports = class VoteSkipCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'voteskip',
            description: 'Mengajukan voting untuk melewati lagu yang sedang diputar.',
            category: 'music',
            usage: 'voteskip',
            aliases: ['voteskip'],
            cooldown: 2000
        });
    }

    async execute(message) {
        try {
            const guild = message.guild;
            if (!guild) return message.reply("⚠️ Tidak dalam server yang valid.");

            const vc = message.member.voice.channel;
            if (!vc) return message.reply("⚠️ Join voice channel dulu.");

            const gid = guild.id;
            const set = votes.get(gid) || new Set();
            const userId = message.author.id;
            set.add(userId);
            votes.set(gid, set);

            const members = vc.members.filter(m => !m.user.bot);
            const ratio = set.size / members.size;

            if (ratio >= 0.5) {
                const { skip } = require("../../services/player");
                skip(message);
                votes.delete(gid);
                return message.reply("⏭️ Vote skip berhasil!");
            }

            await message.reply(`🗳️ Vote skip: ${set.size}/${members.size} (${Math.floor(ratio * 100)}%)`);
        } catch (err) {
            console.error("executeVoteSkip() error:", err);
            await message.reply("❌ Terjadi kesalahan saat melakukan vote skip.");
        }
    }
};
