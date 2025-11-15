/**
 * Application Configuration
 * 
 * Central configuration file for the bot application
 */

require('dotenv').config();

module.exports = {
    // Discord Configuration
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID,
    prefix: process.env.DISCORD_PREFIX || '!',

    // Bot Settings
    djRole: process.env.DISCORD_DJ_ROLE || 'DJ',
    musicChannels: process.env.DISCORD_MUSIC_CHANNELS
        ? process.env.DISCORD_MUSIC_CHANNELS.split(',').map(c => c.trim())
        : [],

    // Audio Configuration
    audio: {
        sourceEndpoint: process.env.DISCORD_AUDIO_SOURCE_ENDPOINT || 'http://localhost:3000',
        sourcePort: parseInt(process.env.AUDIO_SOURCE_PORT) || 3000,
        defaultVolume: parseInt(process.env.AUDIO_VOLUME_DEFAULT) || 80,
        maxVolume: parseInt(process.env.AUDIO_VOLUME_MAX) || 200,
        bitrate: parseInt(process.env.AUDIO_BITRATE) || 128000,
    },

    // Database Configuration (Turso DB)
    database: {
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
        syncUrl: process.env.TURSO_SYNC_URL,
        syncInterval: parseInt(process.env.TURSO_SYNC_INTERVAL) || 60000,
        encryptionKey: process.env.TURSO_ENCRYPTION_KEY,
    },

    // Logging Configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        pretty: process.env.LOG_PRETTY === 'true',
        file: process.env.LOG_FILE || './logs/bot.log',
        maxSize: process.env.LOG_MAX_SIZE || '10m',
        maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
    },

    // Feature Flags
    features: {
        music: process.env.FEATURE_MUSIC !== 'false',
        moderation: process.env.FEATURE_MODERATION !== 'false',
        economy: process.env.FEATURE_ECONOMY !== 'false',
        leveling: process.env.FEATURE_LEVELING !== 'false',
        tickets: process.env.FEATURE_TICKETS !== 'false',
        logging: process.env.FEATURE_LOGGING !== 'false',
    },

    // Rate Limiting
    rateLimit: {
        default: parseInt(process.env.RATE_LIMIT_DEFAULT) || 3000,
        premium: parseInt(process.env.RATE_LIMIT_PREMIUM) || 1000,
        burst: parseInt(process.env.RATE_LIMIT_BURST) || 5,
    },

    // Economy Configuration
    economy: {
        startingBalance: parseInt(process.env.ECONOMY_STARTING_BALANCE) || 1000,
        dailyReward: parseInt(process.env.ECONOMY_DAILY_REWARD) || 500,
        workMin: parseInt(process.env.ECONOMY_WORK_MIN) || 100,
        workMax: parseInt(process.env.ECONOMY_WORK_MAX) || 500,
        transferTax: parseFloat(process.env.ECONOMY_TRANSFER_TAX) || 0.05,
    },

    // Leveling Configuration
    leveling: {
        xpMessageMin: parseInt(process.env.LEVELING_XP_MESSAGE_MIN) || 5,
        xpMessageMax: parseInt(process.env.LEVELING_XP_MESSAGE_MAX) || 15,
        xpVoice: parseInt(process.env.LEVELING_XP_VOICE) || 1,
        base: parseInt(process.env.LEVELING_BASE) || 100,
        multiplier: parseFloat(process.env.LEVELING_MULTIPLIER) || 1.5,
    },

    // Bot Owner
    ownerId: process.env.BOT_OWNER_ID,

    // Environment
    env: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
};
