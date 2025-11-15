/**
 * Configuration Management System
 * Loads and validates configuration with environment-based overrides
 */

class Config {
    constructor(env = process.env.NODE_ENV || 'development') {
        this.env = env;
        this.config = this.loadConfig();
        this.validate();
    }

    loadConfig() {
        const defaultConfig = require('./default');

        // Try to load environment-specific config
        let envConfig = {};
        try {
            envConfig = require(`./${this.env}`);
        } catch (error) {
            // Environment config is optional
            console.log(`No specific config for environment: ${this.env}`);
        }

        return { ...defaultConfig, ...envConfig };
    }

    validate() {
        const required = ['port', 'ffmpegPath'];
        const missing = [];

        for (const key of required) {
            if (!this.config[key]) {
                missing.push(key);
            }
        }

        if (missing.length > 0) {
            throw new Error(`Missing required configuration: ${missing.join(', ')}`);
        }
    }

    get(key, defaultValue) {
        const keys = key.split('.');
        let value = this.config;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }

        return value ?? defaultValue;
    }

    getAll() {
        return { ...this.config };
    }
}

module.exports = new Config();
