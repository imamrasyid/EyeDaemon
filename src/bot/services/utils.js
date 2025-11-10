const prettyMs = require("pretty-ms").default;

function formatMs(n) { return prettyMs(Math.max(0, n | 0), { colonNotation: true, secondsDecimalDigits: 0 }); }

function parseTimeToMs(input) {
    if (!input) return 0;
    if (/^\d+$/.test(input)) return Number(input) * 1000;
    const p = input.split(":").map(Number);
    if (p.length === 3) return (p[0] * 3600 + p[1] * 60 + p[2]) * 1000;
    if (p.length === 2) return (p[0] * 60 + p[1]) * 1000;
    return Number(input) * 1000 || 0;
}

function progressBar(current, total, size = 16) {
    total = Math.max(1, total);
    const pos = Math.min(size - 1, Math.floor(current / total * size));
    let s = ""; for (let i = 0; i < size; i++) s += (i === pos) ? "🔘" : "▬"; return s;
}

function msToTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

async function sendMsg(ctx, content) {
    try {
        // === Slash command ===
        if (ctx.isChatInputCommand?.()) {
            if (!ctx.deferred && !ctx.replied) {
                return await ctx.reply(content);
            } else {
                // kalau sudah deferReply(), maka gunakan followUp()
                return await ctx.followUp(content);
            }
        }

        // === Prefix command ===
        if (ctx.reply) return await ctx.reply(content);
        if (ctx.channel) return await ctx.channel.send(content);

        // === Fallback ===
        const ch = ctx.client?.channels?.cache?.get(ctx.channelId);
        if (ch) return await ch.send(content);
    } catch (e) {
        console.error("sendMsg error:", e.message);
    }
}

// function progressBar(current, total, size = 20) {
//     const ratio = Math.min(current / total, 1);
//     const filled = Math.round(ratio * size);
//     const empty = size - filled;
//     return `\`${"▬".repeat(filled)}🔘${"▬".repeat(empty)}\`\n(${msToTime(current)} / ${msToTime(total)})`;
// }


module.exports = { formatMs, parseTimeToMs, progressBar, msToTime, sendMsg };
