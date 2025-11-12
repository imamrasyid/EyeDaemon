const { config } = require('dotenv');
const path = require('path');

// Load environment variables
config({ path: path.resolve(__dirname, '../../.env') });

const CONFIG = {
  // Discord Configuration
  DISCORD: {
    TOKEN: process.env.DISCORD_TOKEN,
    PREFIX: process.env.DISCORD_PREFIX || '!',
    CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    GUILD_ID: process.env.DISCORD_GUILD_ID,
    DJ_ROLE: process.env.DISCORD_DJ_ROLE,
    MUSIC_CHANNELS: process.env.DISCORD_MUSIC_CHANNELS?.split(',') || [],
    CACHE_PATH: process.env.DISCORD_CACHE_PATH || './src/bot/data/music.db'
  },

  // Audio Configuration
  AUDIO: {
    SOURCE_ENDPOINT: process.env.DISCORD_AUDIO_SOURCE_ENDPOINT,
    SOURCE_PORT: parseInt(process.env.AUDIO_SOURCE_PORT) || 3000,
    VOLUME_DEFAULT: parseInt(process.env.AUDIO_VOLUME_DEFAULT) || 50,
    VOLUME_MAX: parseInt(process.env.AUDIO_VOLUME_MAX) || 100,
    BITRATE: parseInt(process.env.AUDIO_BITRATE) || 128000
  },

  // Database Configuration
  DATABASE: {
    TYPE: process.env.DATABASE_TYPE || 'sqlite',
    PATH: process.env.DATABASE_PATH || './src/bot/data/database.db',
    HOST: process.env.DATABASE_HOST,
    PORT: parseInt(process.env.DATABASE_PORT) || 5432,
    NAME: process.env.DATABASE_NAME,
    USER: process.env.DATABASE_USER,
    PASSWORD: process.env.DATABASE_PASSWORD
  },

  // Logging Configuration
  LOGGING: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    PRETTY: process.env.LOG_PRETTY === 'true',
    FILE: process.env.LOG_FILE || './logs/bot.log',
    MAX_SIZE: process.env.LOG_MAX_SIZE || '10m',
    MAX_FILES: parseInt(process.env.LOG_MAX_FILES) || 5
  },

  // Feature Flags
  FEATURES: {
    MUSIC: process.env.FEATURE_MUSIC !== 'false',
    MODERATION: process.env.FEATURE_MODERATION !== 'false',
    ECONOMY: process.env.FEATURE_ECONOMY !== 'false',
    LEVELING: process.env.FEATURE_LEVELING !== 'false',
    TICKETS: process.env.FEATURE_TICKETS !== 'false',
    LOGGING: process.env.FEATURE_LOGGING !== 'false'
  },

  // Rate Limiting
  RATE_LIMIT: {
    DEFAULT_COOLDOWN: parseInt(process.env.RATE_LIMIT_DEFAULT) || 3000,
    PREMIUM_COOLDOWN: parseInt(process.env.RATE_LIMIT_PREMIUM) || 1000,
    BURST_LIMIT: parseInt(process.env.RATE_LIMIT_BURST) || 5
  },

  // Economy Configuration
  ECONOMY: {
    STARTING_BALANCE: parseInt(process.env.ECONOMY_STARTING_BALANCE) || 1000,
    DAILY_REWARD: parseInt(process.env.ECONOMY_DAILY_REWARD) || 500,
    WORK_REWARD_MIN: parseInt(process.env.ECONOMY_WORK_MIN) || 100,
    WORK_REWARD_MAX: parseInt(process.env.ECONOMY_WORK_MAX) || 500,
    TRANSFER_TAX: parseFloat(process.env.ECONOMY_TRANSFER_TAX) || 0.05
  },

  // Leveling Configuration
  LEVELING: {
    XP_PER_MESSAGE_MIN: parseInt(process.env.LEVELING_XP_MESSAGE_MIN) || 5,
    XP_PER_MESSAGE_MAX: parseInt(process.env.LEVELING_XP_MESSAGE_MAX) || 15,
    XP_PER_VOICE_MINUTE: parseInt(process.env.LEVELING_XP_VOICE) || 1,
    LEVEL_UP_BASE: parseInt(process.env.LEVELING_BASE) || 100,
    LEVEL_UP_MULTIPLIER: parseFloat(process.env.LEVELING_MULTIPLIER) || 1.5
  }
};

// Validation
function validateConfig() {
  const required = [
    'DISCORD.TOKEN',
    'DISCORD.CLIENT_ID'
  ];

  const missing = required.filter(key => {
    const value = key.split('.').reduce((obj, k) => obj?.[k], CONFIG);
    return !value;
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Initialize validation
try {
  validateConfig();
} catch (error) {
  console.error('Configuration Error:', error.message);
  process.exit(1);
}

module.exports = CONFIG;