require("dotenv").config();
module.exports = {
    token: process.env.DISCORD_TOKEN,
    prefix: process.env.DISCORD_PREFIX,
    eyeBase: process.env.DISCORD_AUDIO_SOURCE_ENDPOINT,
    djRole: process.env.DISCORD_DJ_ROLE,
    allowedChannels: (process.env.DISCORD_MUSIC_CHANNELS).split(",").filter(Boolean),
    dbPath: process.env.DISCORD_CACHE_PATH,
    idleMs: 5 * 60 * 1000,
};
