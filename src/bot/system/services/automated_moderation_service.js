/**
 * Automated Moderation Service
 * 
 * Handles automated moderation: anti-spam, anti-link, anti-invite, anti-raid, filters
 */

const logger = require('../helpers/logger_helper');
const { DatabaseError } = require('../core/Errors');

class AutomatedModerationService {
    /**
     * Create a new AutomatedModerationService instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.database = client.database;
        this.message_history = new Map();
        this.violation_counts = new Map();
        this.config_cache = new Map();
    }

    /**
     * Check message for violations
     * @param {Message} message - Discord message
     * @returns {Promise<Object>} Violation result
     */
    async check_message(message) {
        try {
            const guild_id = message.guild?.id;
            if (!guild_id) {
                return { violated: false };
            }

            const config = await this.get_guild_config(guild_id);
            if (!config.enabled) {
                return { violated: false };
            }

            const violations = [];

            // Check spam
            if (config.anti_spam) {
                const spam_result = await this.check_spam(message, config);
                if (spam_result.violated) {
                    violations.push(spam_result);
                }
            }

            // Check links
            if (config.anti_link) {
                const link_result = this.check_links(message, config);
                if (link_result.violated) {
                    violations.push(link_result);
                }
            }

            // Check invites
            if (config.anti_invite) {
                const invite_result = this.check_invites(message, config);
                if (invite_result.violated) {
                    violations.push(invite_result);
                }
            }

            // Check mention spam
            if (config.anti_mention_spam) {
                const mention_result = this.check_mention_spam(message, config);
                if (mention_result.violated) {
                    violations.push(mention_result);
                }
            }

            // Check caps
            if (config.anti_caps) {
                const caps_result = this.check_caps(message, config);
                if (caps_result.violated) {
                    violations.push(caps_result);
                }
            }

            // Check emoji spam
            if (config.anti_emoji_spam) {
                const emoji_result = this.check_emoji_spam(message, config);
                if (emoji_result.violated) {
                    violations.push(emoji_result);
                }
            }

            // Check word filter
            if (config.word_filter && config.word_filter.length > 0) {
                const word_result = this.check_word_filter(message, config);
                if (word_result.violated) {
                    violations.push(word_result);
                }
            }

            // Check regex filters
            if (config.regex_filters && config.regex_filters.length > 0) {
                const regex_result = this.check_regex_filters(message, config);
                if (regex_result.violated) {
                    violations.push(regex_result);
                }
            }

            if (violations.length > 0) {
                return {
                    violated: true,
                    violations,
                    action: this.determine_action(violations, config),
                };
            }

            return { violated: false };
        } catch (error) {
            logger.error('Failed to check message', {
                error: error.message,
                message_id: message.id,
            });
            return { violated: false };
        }
    }

    /**
     * Check for spam
     * @param {Message} message - Discord message
     * @param {Object} config - Moderation config
     * @returns {Object} Spam check result
     * @private
     */
    async check_spam(message, config) {
        const user_id = message.author.id;
        const guild_id = message.guild.id;
        const key = `${guild_id}-${user_id}`;

        const history = this.message_history.get(key) || [];
        const now = Date.now();

        // Remove old messages
        const recent_history = history.filter((msg_time) => now - msg_time < config.spam_window || 5000);

        // Add current message
        recent_history.push(now);
        this.message_history.set(key, recent_history);

        // Check threshold
        const threshold = config.spam_threshold || 5;
        if (recent_history.length >= threshold) {
            return {
                violated: true,
                type: 'spam',
                count: recent_history.length,
                threshold,
            };
        }

        return { violated: false };
    }

    /**
     * Check for links
     * @param {Message} message - Discord message
     * @param {Object} config - Moderation config
     * @returns {Object} Link check result
     * @private
     */
    check_links(message, config) {
        const url_pattern = /https?:\/\/[^\s]+/gi;
        const links = message.content.match(url_pattern) || [];

        if (links.length > 0) {
            // Check whitelist
            if (config.link_whitelist) {
                const whitelisted = links.some((link) =>
                    config.link_whitelist.some((whitelist) => link.includes(whitelist))
                );
                if (whitelisted) {
                    return { violated: false };
                }
            }

            return {
                violated: true,
                type: 'link',
                links,
            };
        }

        return { violated: false };
    }

    /**
     * Check for Discord invites
     * @param {Message} message - Discord message
     * @param {Object} config - Moderation config
     * @returns {Object} Invite check result
     * @private
     */
    check_invites(message, config) {
        const invite_pattern = /(?:discord\.(?:gg|io|me|li)|discordapp\.com\/invite)\/[a-zA-Z0-9]+/gi;
        const invites = message.content.match(invite_pattern) || [];

        if (invites.length > 0) {
            return {
                violated: true,
                type: 'invite',
                invites,
            };
        }

        return { violated: false };
    }

    /**
     * Check for mention spam
     * @param {Message} message - Discord message
     * @param {Object} config - Moderation config
     * @returns {Object} Mention spam check result
     * @private
     */
    check_mention_spam(message, config) {
        const mention_count = message.mentions.users.size + message.mentions.roles.size;
        const threshold = config.mention_spam_threshold || 5;

        if (mention_count >= threshold) {
            return {
                violated: true,
                type: 'mention_spam',
                count: mention_count,
                threshold,
            };
        }

        return { violated: false };
    }

    /**
     * Check for excessive caps
     * @param {Message} message - Discord message
     * @param {Object} config - Moderation config
     * @returns {Object} Caps check result
     * @private
     */
    check_caps(message, config) {
        const content = message.content;
        if (content.length < (config.caps_min_length || 10)) {
            return { violated: false };
        }

        const caps_count = (content.match(/[A-Z]/g) || []).length;
        const caps_ratio = caps_count / content.length;
        const threshold = config.caps_threshold || 0.7;

        if (caps_ratio >= threshold) {
            return {
                violated: true,
                type: 'caps',
                ratio: caps_ratio,
                threshold,
            };
        }

        return { violated: false };
    }

    /**
     * Check for emoji spam
     * @param {Message} message - Discord message
     * @param {Object} config - Moderation config
     * @returns {Object} Emoji spam check result
     * @private
     */
    check_emoji_spam(message, config) {
        const emoji_pattern = /<a?:[\w]+:\d+>|[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
        const emojis = message.content.match(emoji_pattern) || [];
        const threshold = config.emoji_spam_threshold || 5;

        if (emojis.length >= threshold) {
            return {
                violated: true,
                type: 'emoji_spam',
                count: emojis.length,
                threshold,
            };
        }

        return { violated: false };
    }

    /**
     * Check word filter
     * @param {Message} message - Discord message
     * @param {Object} config - Moderation config
     * @returns {Object} Word filter check result
     * @private
     */
    check_word_filter(message, config) {
        const content_lower = message.content.toLowerCase();

        for (const word of config.word_filter) {
            if (content_lower.includes(word.toLowerCase())) {
                return {
                    violated: true,
                    type: 'word_filter',
                    word,
                };
            }
        }

        return { violated: false };
    }

    /**
     * Check regex filters
     * @param {Message} message - Discord message
     * @param {Object} config - Moderation config
     * @returns {Object} Regex filter check result
     * @private
     */
    check_regex_filters(message, config) {
        for (const pattern_str of config.regex_filters) {
            try {
                const pattern = new RegExp(pattern_str, 'i');
                if (pattern.test(message.content)) {
                    return {
                        violated: true,
                        type: 'regex_filter',
                        pattern: pattern_str,
                    };
                }
            } catch (error) {
                logger.warn('Invalid regex pattern', {
                    pattern: pattern_str,
                    error: error.message,
                });
            }
        }

        return { violated: false };
    }

    /**
     * Determine action based on violations
     * @param {Array} violations - Array of violations
     * @param {Object} config - Moderation config
     * @returns {string} Action to take
     * @private
     */
    determine_action(violations, config) {
        // Get violation count for user
        const user_id = violations[0]?.user_id;
        if (user_id) {
            const count = (this.violation_counts.get(user_id) || 0) + 1;
            this.violation_counts.set(user_id, count);

            // Escalate based on count
            if (count >= (config.ban_threshold || 5)) {
                return 'ban';
            } else if (count >= (config.kick_threshold || 3)) {
                return 'kick';
            } else if (count >= (config.warn_threshold || 2)) {
                return 'warn';
            }
        }

        // Default action
        return config.default_action || 'delete';
    }

    /**
     * Get guild moderation config
     * @param {string} guild_id - Guild ID
     * @returns {Promise<Object>} Moderation config
     */
    async get_guild_config(guild_id) {
        if (this.config_cache.has(guild_id)) {
            return this.config_cache.get(guild_id);
        }

        try {
            const config = await this.database.queryOne(
                'SELECT * FROM moderation_config WHERE guild_id = ?',
                [guild_id]
            );

            const default_config = {
                enabled: false,
                anti_spam: true,
                anti_link: false,
                anti_invite: true,
                anti_mention_spam: true,
                anti_caps: false,
                anti_emoji_spam: false,
                word_filter: [],
                regex_filters: [],
                spam_threshold: 5,
                spam_window: 5000,
                mention_spam_threshold: 5,
                caps_threshold: 0.7,
                caps_min_length: 10,
                emoji_spam_threshold: 5,
                default_action: 'delete',
                warn_threshold: 2,
                kick_threshold: 3,
                ban_threshold: 5,
            };

            const merged_config = config
                ? { ...default_config, ...config }
                : default_config;

            this.config_cache.set(guild_id, merged_config);
            return merged_config;
        } catch (error) {
            logger.error('Failed to get moderation config', {
                error: error.message,
                guild_id,
            });
            return {
                enabled: false,
            };
        }
    }

    /**
     * Clear violation count for user
     * @param {string} user_id - User ID
     * @returns {void}
     */
    clear_violation_count(user_id) {
        this.violation_counts.delete(user_id);
    }

    /**
     * Cleanup old message history
     * @returns {void}
     */
    cleanup_history() {
        const now = Date.now();
        const max_age = 60000; // 1 minute

        for (const [key, history] of this.message_history.entries()) {
            const recent = history.filter((time) => now - time < max_age);
            if (recent.length === 0) {
                this.message_history.delete(key);
            } else {
                this.message_history.set(key, recent);
            }
        }
    }
}

module.exports = AutomatedModerationService;
