const { sendMsg } = require("../services/utils");

/**
 * Menampilkan daftar perintah atau deskripsi perintah tertentu.
 * Mendukung !help dan /help
 */
module.exports = {
    name: "help",
    description: "Menampilkan daftar perintah atau deskripsi perintah tertentu.",
    usage: "help [command]",
    example: "help play",
    category: "utility",
    async prefix(message, args) {
        await executeHelp(message, args);
    },
    async slash(interaction) {
        await executeHelp(interaction, []);
    },
};

/**
 * Fungsi utama bantuan perintah
 */
async function executeHelp(ctx, args) {
    try {
        const isInteraction = !!ctx.isCommand;
        const client = ctx.client || ctx.client;
        const commands = client.commands || new Map();

        // jika user mengetik !help <command>
        const query = (args[0] || (isInteraction ? ctx.options.getString("command") : ""))?.toLowerCase();
        if (query) {
            const cmd = commands.get(query) || [...commands.values()].find(c => c.aliases?.includes(query));
            if (!cmd) return sendMsg(ctx, `❓ Perintah \`${query}\` tidak ditemukan.`);

            let text = `**🆘 Bantuan: ${ctx.client.prefix || "/"}${cmd.name}**\n`;
            text += cmd.description ? `> ${cmd.description}\n\n` : "";
            text += cmd.usage ? `**Penggunaan:** ${ctx.client.prefix || "/"}${cmd.usage}\n` : "";
            text += cmd.example ? `**Contoh:** ${ctx.client.prefix || "/"}${cmd.example}\n` : "";
            text += cmd.aliases?.length ? `**Alias:** ${cmd.aliases.join(", ")}\n` : "";
            return sendMsg(ctx, text);
        }

        // tampilkan daftar umum
        const categorized = {
            "🎵 Musik": ["play", "stop", "skip", "pause", "resume", "leave"],
            "📜 Antrian": ["queue", "shuffle", "remove", "move", "clear"],
            "⚙️ Pengaturan": ["volume", "loop", "filter", "seek"],
            "🧠 Utility": []
        };

        const output = {};
        for (const [cat, keys] of Object.entries(categorized)) {
            output[cat] = [];
            for (const cmd of commands.values()) {
                if (keys.length ? keys.includes(cmd.name) : !Object.values(categorized).flat().includes(cmd.name)) {
                    output[cat].push(cmd);
                }
            }
        }

        let text = `🎧 **EyeDaemon Music Bot** — Bantuan Umum\nGunakan \`${ctx.client.prefix || "/"}help <command>\` untuk info lebih detail.\n\n`;
        for (const [cat, cmds] of Object.entries(output)) {
            if (!cmds.length) continue;
            text += `**${cat}**\n${cmds.map(c => `• \`${ctx.client.prefix || "/"}${c.name}\` — ${c.description || "-"}`).join("\n")}\n\n`;
        }

        text += `Ketik \`${ctx.client.prefix || "/"}help <command>\` untuk penjelasan perintah tertentu.\n`;
        text += `Contoh: \`${ctx.client.prefix || "/"}help play\`\n`;
        text += `\n👨‍💻 Dibuat dengan ❤️ oleh tim EyeDaemon.`;

        await sendMsg(ctx, text);
    } catch (err) {
        console.error("help() error:", err);
        await sendMsg(ctx, "❌ Terjadi kesalahan saat menampilkan bantuan.");
    }
}
