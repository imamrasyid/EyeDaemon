const { getState } = require("../services/player");
const { sendMsg } = require("../services/utils");

const votes = new Map(); // gid -> Set(userId)

/**
 * Mengajukan voting untuk melewati lagu yang sedang diputar.
 * Mendukung !voteskip dan /voteskip
 */
module.exports = {
    name: "voteskip",
    description: "Mengajukan voting untuk melewati lagu yang sedang diputar.",
    usage: "voteskip",
    example: "voteskip",
    category: "music",
    async prefix(message) {
        await executeVoteSkip(message);
    },
    async slash(interaction) {
        await executeVoteSkip(interaction);
    },
};

/**
 * Fungsi utama vote skip
 */
async function executeVoteSkip(ctx) {
    try {
        const guild = ctx.guild;
        if (!guild) return sendMsg(ctx, "⚠️ Tidak dalam server yang valid.");

        const vc = ctx.member.voice.channel;
        if (!vc) return sendMsg(ctx, "⚠️ Join voice channel dulu.");

        const gid = guild.id;
        const set = votes.get(gid) || new Set();
        const userId = ctx.user?.id || ctx.author?.id;
        set.add(userId);
        votes.set(gid, set);

        const members = vc.members.filter(m => !m.user.bot);
        const ratio = set.size / members.size;

        if (ratio >= 0.5) {
            const { skip } = require("../services/player");
            skip(ctx);
            votes.delete(gid);
            return sendMsg(ctx, "⏭️ Vote skip berhasil!");
        }

        await sendMsg(ctx, `🗳️ Vote skip: ${set.size}/${members.size} (${Math.floor(ratio * 100)}%)`);
    } catch (err) {
        console.error("executeVoteSkip() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat melakukan vote skip.");
    }
}
