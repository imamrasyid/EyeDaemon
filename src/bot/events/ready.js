const { restoreForGuild } = require("../services/player");

function setupReady(client) {
    client.once("clientReady", async () => {
        console.log(`✅ Logged in as ${client.user.tag}`);
        client.user.setPresence({ activities: [{ name: "musik 🎧", type: 2 }], status: "idle" });
        // optional: restore queues per guild (akan mulai main jika channel fetcher dikonfig)
        // contoh channelFetcher dummy: cari text channel pertama
        const channelFetcher = async (gid) => {
            const g = await client.guilds.fetch(gid).catch(() => null);
            if (!g) return {};
            const ch = (await g.channels.fetch()).find(c => c.isTextBased?.());
            return { textChannel: ch };
        };
        for (const [gid] of client.guilds.cache) {
            await restoreForGuild(gid, channelFetcher); // mulai lagi jika ada queue
        }
    });
}
module.exports = { setupReady };
