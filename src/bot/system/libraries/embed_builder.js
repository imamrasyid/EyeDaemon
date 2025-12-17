/**
 * Embed Builder
 * 
 * Builds rich embeds with templates and dynamic content
 */

const { EmbedBuilder, Colors } = require('discord.js');
const logger = require('../helpers/logger_helper');

class EmbedBuilderLibrary {
    /**
     * Create a new EmbedBuilderLibrary instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.templates = new Map();
    }

    /**
     * Create a basic embed
     * @param {Object} options - Embed options
     * @returns {EmbedBuilder} Embed builder instance
     */
    create(options = {}) {
        const embed = new EmbedBuilder();

        if (options.title) {
            embed.setTitle(options.title);
        }

        if (options.description) {
            embed.setDescription(options.description);
        }

        if (options.color) {
            embed.setColor(options.color);
        } else if (options.color_name) {
            embed.setColor(this._get_color_by_name(options.color_name));
        }

        if (options.url) {
            embed.setURL(options.url);
        }

        if (options.author) {
            embed.setAuthor(options.author);
        }

        if (options.thumbnail) {
            embed.setThumbnail(options.thumbnail);
        }

        if (options.image) {
            embed.setImage(options.image);
        }

        if (options.footer) {
            embed.setFooter(options.footer);
        }

        if (options.timestamp) {
            embed.setTimestamp(options.timestamp === true ? new Date() : options.timestamp);
        }

        if (options.fields && Array.isArray(options.fields)) {
            options.fields.forEach((field) => {
                embed.addFields(field);
            });
        }

        return embed;
    }

    /**
     * Create success embed
     * @param {string} message - Success message
     * @param {Object} options - Additional options
     * @returns {EmbedBuilder} Embed builder instance
     */
    success(message, options = {}) {
        return this.create({
            title: options.title || '✅ Success',
            description: message,
            color: Colors.Green,
            ...options,
        });
    }

    /**
     * Create error embed
     * @param {string} message - Error message
     * @param {Object} options - Additional options
     * @returns {EmbedBuilder} Embed builder instance
     */
    error(message, options = {}) {
        return this.create({
            title: options.title || '❌ Error',
            description: message,
            color: Colors.Red,
            ...options,
        });
    }

    /**
     * Create warning embed
     * @param {string} message - Warning message
     * @param {Object} options - Additional options
     * @returns {EmbedBuilder} Embed builder instance
     */
    warning(message, options = {}) {
        return this.create({
            title: options.title || '⚠️ Warning',
            description: message,
            color: Colors.Yellow,
            ...options,
        });
    }

    /**
     * Create info embed
     * @param {string} message - Info message
     * @param {Object} options - Additional options
     * @returns {EmbedBuilder} Embed builder instance
     */
    info(message, options = {}) {
        return this.create({
            title: options.title || 'ℹ️ Information',
            description: message,
            color: Colors.Blue,
            ...options,
        });
    }

    /**
     * Create pagination embed
     * @param {Array} pages - Array of embed data
     * @param {number} current_page - Current page index
     * @param {Object} options - Additional options
     * @returns {EmbedBuilder} Embed builder instance
     */
    pagination(pages, current_page = 0, options = {}) {
        if (!pages || pages.length === 0) {
            return this.error('No pages available');
        }

        const page_index = Math.max(0, Math.min(current_page, pages.length - 1));
        const page_data = pages[page_index];

        const embed = this.create({
            ...page_data,
            footer: {
                text: options.footer_text || `Page ${page_index + 1} of ${pages.length}`,
                iconURL: options.footer_icon,
            },
            ...options,
        });

        return embed;
    }

    /**
     * Register an embed template
     * @param {string} name - Template name
     * @param {Object|Function} template - Template data or function
     * @returns {void}
     */
    register_template(name, template) {
        this.templates.set(name, template);
        logger.debug(`Registered embed template: ${name}`);
    }

    /**
     * Create embed from template
     * @param {string} template_name - Template name
     * @param {Object} variables - Variables to replace in template
     * @returns {EmbedBuilder} Embed builder instance
     */
    from_template(template_name, variables = {}) {
        const template = this.templates.get(template_name);

        if (!template) {
            logger.warn(`Template ${template_name} not found`);
            return this.error(`Template ${template_name} not found`);
        }

        let template_data;

        if (typeof template === 'function') {
            template_data = template(variables);
        } else {
            template_data = this._replace_variables(template, variables);
        }

        return this.create(template_data);
    }

    /**
     * Replace variables in template
     * @param {Object} template - Template object
     * @param {Object} variables - Variables to replace
     * @returns {Object} Template with replaced variables
     * @private
     */
    _replace_variables(template, variables) {
        const result = { ...template };

        for (const [key, value] of Object.entries(result)) {
            if (typeof value === 'string') {
                result[key] = this._replace_string_variables(value, variables);
            } else if (Array.isArray(value)) {
                result[key] = value.map((item) => {
                    if (typeof item === 'string') {
                        return this._replace_string_variables(item, variables);
                    }
                    if (typeof item === 'object') {
                        return this._replace_variables(item, variables);
                    }
                    return item;
                });
            } else if (typeof value === 'object' && value !== null) {
                result[key] = this._replace_variables(value, variables);
            }
        }

        return result;
    }

    /**
     * Replace variables in string
     * @param {string} str - String with variables
     * @param {Object} variables - Variables object
     * @returns {string} String with replaced variables
     * @private
     */
    _replace_string_variables(str, variables) {
        let result = str;

        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            result = result.replace(regex, String(value));
        }

        return result;
    }

    /**
     * Get color by name
     * @param {string} name - Color name
     * @returns {number} Color value
     * @private
     */
    _get_color_by_name(name) {
        const color_map = {
            default: Colors.Default,
            white: Colors.White,
            aqua: Colors.Aqua,
            green: Colors.Green,
            blue: Colors.Blue,
            yellow: Colors.Yellow,
            purple: Colors.Purple,
            luminous_vivid_pink: Colors.LuminousVividPink,
            fuchsia: Colors.Fuchsia,
            gold: Colors.Gold,
            orange: Colors.Orange,
            red: Colors.Red,
            grey: Colors.Grey,
            darker_grey: Colors.DarkerGrey,
            navy: Colors.Navy,
            dark_aqua: Colors.DarkAqua,
            dark_green: Colors.DarkGreen,
            dark_blue: Colors.DarkBlue,
            dark_purple: Colors.DarkPurple,
            dark_vivid_pink: Colors.DarkVividPink,
            dark_gold: Colors.DarkGold,
            dark_orange: Colors.DarkOrange,
            dark_red: Colors.DarkRed,
            dark_grey: Colors.DarkGrey,
            light_grey: Colors.LightGrey,
            dark_navy: Colors.DarkNavy,
            blurple: Colors.Blurple,
            greyple: Colors.Greyple,
            dark_but_not_black: Colors.DarkButNotBlack,
            not_quite_black: Colors.NotQuiteBlack,
            random: Math.floor(Math.random() * 0xffffff),
        };

        return color_map[name.toLowerCase()] || Colors.Default;
    }

    /**
     * Create multi-embed message
     * @param {Array} embeds_data - Array of embed data
     * @returns {Array<EmbedBuilder>} Array of embed builders
     */
    create_multi_embed(embeds_data) {
        return embeds_data.map((data) => this.create(data));
    }
}

module.exports = EmbedBuilderLibrary;
