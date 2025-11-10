require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const { token, prefix } = require("./config");
const { registerCommands } = require("./interactions/register");
const { setupVoiceIdle } = require("./events/voiceState");
const { setupReady } = require("./events/ready");
const { checkChannel, requireDJ } = require("./services/permissions");
const { ensureConnection, play, restoreForGuild } = require("./services/player");
const { listAllGuilds } = require("./services/storage");
const fs = require("fs");
const path = require("path");

// ========== CONFIG CLIENT ==========
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// ========== LOAD COMMANDS ==========
const commandsPath = path.join(__dirname, "commands");
const cmdFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));
const commands = new Collection();
for (const file of cmdFiles) {
    const cmd = require(path.join(commandsPath, file));
    commands.set(cmd.name, cmd);
}
client.commands = commands;

// ========== INITIAL SETUP ==========
setupVoiceIdle(client);
setupReady(client);

// ========== INTERACTION HANDLER ==========
client.on("interactionCreate", async (interaction) => {
    try {
        if (!interaction.isChatInputCommand()) return;
        const cmd = commands.get(interaction.commandName);
        if (!cmd) return;
        if (!checkChannel(interaction))
            return interaction.reply({ content: "Channel ini tidak diizinkan.", flags: 64 });

        const djOnly = new Set(["stop", "skip", "remove", "move", "clear", "volume", "loop", "shuffle", "seek", "filter"]);
        if (djOnly.has(interaction.commandName) && interaction.member.id !== "976337922011836426" && !requireDJ(interaction.member))
            return interaction.reply({ content: `Butuh role DJ untuk perintah ini.`, flags: 64 });

        await cmd.slash?.(interaction);
    } catch (e) {
        console.error(e);
        if (interaction.reply) {
            await interaction.reply({ content: `❌ ${e.message}`, flags: 64 }).catch(() => { });
        }
    }
});

// ========== PREFIX HANDLER ==========
client.on("messageCreate", async (m) => {
    if (m.author.bot || !m.content.startsWith(prefix)) return;
    if (!checkChannel(m)) return;

    const args = m.content.slice(prefix.length).trim().split(/\s+/);
    const name = args.shift()?.toLowerCase();
    const cmd = commands.get(name);

    if (!cmd) {
        if (name === "play") {
            await ensureConnection(m);
            return play(m, args.join(" "));
        }
        return m.reply("Perintah tidak dikenal.");
    }

    const djOnly = new Set(["stop", "skip", "remove", "move", "clear", "volume", "loop", "shuffle", "seek", "filter"]);
    if (djOnly.has(name) && m.author.id !== "976337922011836426" && !requireDJ(m.member))
        return m.reply(`Butuh role DJ untuk perintah ini.`);

    await cmd.prefix?.(m, args);
});

// ========== SAFE LOGIN WITH RETRY ==========
async function safeLogin(retry = 0) {
    try {
        console.log("🔌 Connecting to Discord...");
        await client.login(token);
        console.log("✅ Login successful");
    } catch (err) {
        const msg = err?.code || err?.message || err;
        console.error("❌ Login error:", msg);

        if (msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED")) {
            const delay = Math.min(30000, 5000 * (retry + 1));
            console.warn(`🌐 Network/DNS error, retrying in ${delay / 1000}s...`);
            setTimeout(() => safeLogin(retry + 1), delay);
        } else {
            console.error("🚨 Unrecoverable login error. Bot stopped.");
            process.exit(1);
        }
    }
}

// ========== READY EVENT ==========
client.once("clientReady", async () => {
    try {
        await registerCommands(client);
        console.log(`🎶 Logged in as ${client.user.tag}`);

        // 🔁 Auto-restore semua guild yang punya queue tersimpan
        const gids = listAllGuilds();
        for (const gid of gids) {
            try {
                const g = client.guilds.cache.get(gid);
                if (!g) continue;

                await restoreForGuild(gid, async (gid) => {
                    const gg = client.guilds.cache.get(gid);
                    if (!gg) return {};
                    // cari text channel pertama yang bisa kirim pesan
                    const textChannel = gg.channels.cache.find(ch => ch.isTextBased && (typeof ch.isTextBased === "function" ? ch.isTextBased() : ch.isTextBased) && gg.members.me && ch.permissionsFor(gg.members.me)?.has("SendMessages"));
                    return {
                        textChannel
                    };
                });

                console.log(`🔁 Restored queue for guild ${gid}`);
            } catch (e) {
                console.warn(`⚠️ Restore failed for guild ${gid}:`, e?.message || e);
            }
        }
    } catch (e) {
        console.error("⚠️ Register command error:", e);
    }
});

// ========== GLOBAL ERROR HANDLERS ==========
process.on("unhandledRejection", (err) => {
    console.error("🚨 Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
    console.error("🔥 Uncaught Exception:", err);
});

// Graceful shutdown
process.on("SIGINT", () => {
    console.log("\n🧹 Shutting down gracefully...");
    client.destroy();
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log("\n🧹 Shutting down (SIGTERM)...");
    client.destroy();
    process.exit(0);
});

// ========== STARTUP ==========
safeLogin();