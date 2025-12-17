/**
 * Localization Helper
 * 
 * Provides multi-language support for commands and messages
 */

const { Collection } = require('discord.js');
const logger = require('./logger_helper');

class LocalizationHelper {
    /**
     * Create a new LocalizationHelper instance
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        this.default_locale = options.default_locale || 'en-US';
        this.supported_locales = options.supported_locales || ['en-US', 'id-ID'];
        this.translations = new Collection();
        this.locale_cache = new Collection();
    }

    /**
     * Load translations
     * @param {string} locale - Locale code
     * @param {Object} translations - Translation object
     * @returns {void}
     */
    load_translations(locale, translations) {
        if (!this.supported_locales.includes(locale)) {
            logger.warn(`Locale ${locale} is not in supported locales`);
            return;
        }

        const existing = this.translations.get(locale) || {};
        this.translations.set(locale, { ...existing, ...translations });

        logger.debug(`Loaded translations for locale: ${locale}`);
    }

    /**
     * Get translation
     * @param {string} key - Translation key (supports dot notation)
     * @param {Object} locale - Locale code or interaction/guild
     * @param {Object} variables - Variables to replace in translation
     * @returns {string} Translated string
     */
    translate(key, locale = null, variables = {}) {
        // Determine locale
        let target_locale = this.default_locale;

        if (locale) {
            if (typeof locale === 'string') {
                target_locale = locale;
            } else if (locale.locale) {
                // Interaction locale
                target_locale = locale.locale;
            } else if (locale.preferredLocale) {
                // Guild locale
                target_locale = locale.preferredLocale;
            }
        }

        // Normalize locale
        if (!this.supported_locales.includes(target_locale)) {
            target_locale = this.default_locale;
        }

        // Get translations for locale
        const translations = this.translations.get(target_locale) || {};
        if (Object.keys(translations).length === 0) {
            // Fallback to default locale
            const default_translations = this.translations.get(this.default_locale) || {};
            return this._get_nested_value(default_translations, key, key, variables);
        }

        return this._get_nested_value(translations, key, key, variables);
    }

    /**
     * Get nested value from object
     * @param {Object} obj - Object to search
     * @param {string} key - Key path (dot notation)
     * @param {string} fallback - Fallback key
     * @param {Object} variables - Variables to replace
     * @returns {string} Value or fallback
     * @private
     */
    _get_nested_value(obj, key, fallback, variables = {}) {
        const keys = key.split('.');
        let value = obj;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                // Try fallback locale
                const fallback_translations = this.translations.get(this.default_locale) || {};
                const fallback_value = this._get_nested_value(fallback_translations, fallback, fallback);
                return this._replace_variables(fallback_value, variables);
            }
        }

        if (typeof value === 'string') {
            return this._replace_variables(value, variables);
        }

        return fallback;
    }

    /**
     * Replace variables in string
     * @param {string} str - String with variables
     * @param {Object} variables - Variables object
     * @returns {string} String with replaced variables
     * @private
     */
    _replace_variables(str, variables = {}) {
        let result = str;

        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            result = result.replace(regex, String(value));
        }

        return result;
    }

    /**
     * Get user locale from interaction or guild
     * @param {Interaction|Guild} source - Interaction or guild
     * @returns {string} Locale code
     */
    get_user_locale(source) {
        if (source.locale) {
            return source.locale;
        }

        if (source.guild?.preferredLocale) {
            return source.guild.preferredLocale;
        }

        return this.default_locale;
    }

    /**
     * Register command translations
     * @param {string} command_name - Command name
     * @param {Object} translations - Translations by locale
     * @returns {void}
     */
    register_command_translations(command_name, translations) {
        for (const [locale, translation] of Object.entries(translations)) {
            if (!this.translations.has(locale)) {
                this.translations.set(locale, {});
            }

            const locale_translations = this.translations.get(locale);
            locale_translations.commands = locale_translations.commands || {};
            locale_translations.commands[command_name] = translation;

            this.translations.set(locale, locale_translations);
        }

        logger.debug(`Registered translations for command: ${command_name}`);
    }

    /**
     * Get command name translation
     * @param {string} command_name - Command name
     * @param {string} locale - Locale code
     * @returns {string} Translated command name
     */
    get_command_name(command_name, locale = null) {
        const target_locale = locale || this.default_locale;
        const translations = this.translations.get(target_locale);

        if (translations?.commands?.[command_name]?.name) {
            return translations.commands[command_name].name;
        }

        return command_name;
    }

    /**
     * Get command description translation
     * @param {string} command_name - Command name
     * @param {string} locale - Locale code
     * @returns {string} Translated command description
     */
    get_command_description(command_name, locale = null) {
        const target_locale = locale || this.default_locale;
        const translations = this.translations.get(target_locale);

        if (translations?.commands?.[command_name]?.description) {
            return translations.commands[command_name].description;
        }

        return '';
    }
}

// Create singleton instance
const localization_helper = new LocalizationHelper();

// Load default translations
localization_helper.load_translations('en-US', {
    errors: {
        permission_denied: "❌ You don't have permission to do that.",
        command_not_found: "❌ Command not found.",
        invalid_input: "❌ Invalid input provided.",
        rate_limited: "⏳ Please wait before using this again.",
        generic_error: "❌ An error occurred. Please try again.",
    },
    common: {
        yes: 'Yes',
        no: 'No',
        cancel: 'Cancel',
        confirm: 'Confirm',
        loading: 'Loading...',
        success: '✅ Success!',
        error: '❌ Error',
    },
});

localization_helper.load_translations('id-ID', {
    errors: {
        permission_denied: '❌ Anda tidak memiliki izin untuk melakukan itu.',
        command_not_found: '❌ Perintah tidak ditemukan.',
        invalid_input: '❌ Input tidak valid.',
        rate_limited: '⏳ Harap tunggu sebelum menggunakan lagi.',
        generic_error: '❌ Terjadi kesalahan. Silakan coba lagi.',
    },
    common: {
        yes: 'Ya',
        no: 'Tidak',
        cancel: 'Batal',
        confirm: 'Konfirmasi',
        loading: 'Memuat...',
        success: '✅ Berhasil!',
        error: '❌ Kesalahan',
    },
});

module.exports = localization_helper;
