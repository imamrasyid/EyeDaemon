const { getState, scheduleIdleCleanup } = require("../services/player");

function setupVoiceIdle(client) {
    client.on("voiceStateUpdate", (oldState, newState) => {
        const ch = oldState.channel || newState.channel;
        if (!ch) return;

        const gid = ch.guild.id;
        const s = getState(gid);
        if (!s.connection) return;

        // Hanya kalau channel benar2 kosong (tanpa user non-bot)
        const nonBots = ch.members.filter(m => !m.user.bot);
        if (nonBots.size === 0) {
            // gunakan durasi lagu yang sedang/terakhir diputar sebagai basis timeout adaptif
            scheduleIdleCleanup(gid, ch, s.now || s.queue?.[0]);
        } else {
            // ada user lagi → batalkan timer idle bila ada
            if (s.idleTimer) { clearTimeout(s.idleTimer); s.idleTimer = null; }
        }
    });
}

module.exports = { setupVoiceIdle };
