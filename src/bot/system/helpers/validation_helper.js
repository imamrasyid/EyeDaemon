/**
 * Validation Helper
 * 
 * Provides contextual validation for commands and inputs
 */

const { PermissionFlagsBits } = require('discord.js');
const logger = require('./logger_helper');
const { ValidationError } = require('../core/Errors');

class ValidationHelper {
    /**
     * Validate user input
     * @param {string} input - Input to validate
     * @param {Object} rules - Validation rules
     * @returns {Object} Validation result
     */
    validate_input(input, rules) {
        const errors = [];

        // Required check
        if (rules.required && (!input || input.trim().length === 0)) {
            errors.push('This field is required.');
            return { valid: false, errors };
        }

        if (!input || input.trim().length === 0) {
            return { valid: true, errors: [] };
        }

        // Min length
        if (rules.min_length && input.length < rules.min_length) {
            errors.push(`Input must be at least ${rules.min_length} characters.`);
        }

        // Max length
        if (rules.max_length && input.length > rules.max_length) {
            errors.push(`Input must be at most ${rules.max_length} characters.`);
        }

        // Pattern match
        if (rules.pattern && !rules.pattern.test(input)) {
            errors.push(rules.pattern_message || 'Input does not match required pattern.');
        }

        // Custom validator
        if (rules.validator && typeof rules.validator === 'function') {
            try {
                const result = rules.validator(input);
                if (result !== true) {
                    errors.push(result || 'Validation failed.');
                }
            } catch (error) {
                errors.push('Custom validation failed.');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Validate Discord user ID
     * @param {string} user_id - User ID to validate
     * @returns {boolean} True if valid
     */
    validate_user_id(user_id) {
        return /^\d{17,19}$/.test(user_id);
    }

    /**
     * Validate Discord channel ID
     * @param {string} channel_id - Channel ID to validate
     * @returns {boolean} True if valid
     */
    validate_channel_id(channel_id) {
        return /^\d{17,19}$/.test(channel_id);
    }

    /**
     * Validate Discord role ID
     * @param {string} role_id - Role ID to validate
     * @returns {boolean} True if valid
     */
    validate_role_id(role_id) {
        return /^\d{17,19}$/.test(role_id);
    }

    /**
     * Validate Discord guild ID
     * @param {string} guild_id - Guild ID to validate
     * @returns {boolean} True if valid
     */
    validate_guild_id(guild_id) {
        return /^\d{17,19}$/.test(guild_id);
    }

    /**
     * Validate URL
     * @param {string} url - URL to validate
     * @returns {boolean} True if valid
     */
    validate_url(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate email
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid
     */
    validate_email(email) {
        const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return email_regex.test(email);
    }

    /**
     * Validate number range
     * @param {number} value - Value to validate
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {boolean} True if valid
     */
    validate_number_range(value, min, max) {
        const num = Number(value);
        return !isNaN(num) && num >= min && num <= max;
    }

    /**
     * Validate command options
     * @param {Interaction} interaction - Discord interaction
     * @param {Object} option_rules - Option validation rules
     * @returns {Object} Validation result
     */
    validate_command_options(interaction, option_rules) {
        const errors = [];
        const options = interaction.options;

        for (const [option_name, rules] of Object.entries(option_rules)) {
            const option = options.get(option_name);
            const value = option?.value;

            // Required check
            if (rules.required && (!option || value === null || value === undefined)) {
                errors.push(`Option '${option_name}' is required.`);
                continue;
            }

            if (!option || value === null || value === undefined) {
                continue;
            }

            // Type check
            if (rules.type) {
                const expected_type = rules.type;
                const actual_type = typeof value;

                if (expected_type === 'number' && isNaN(Number(value))) {
                    errors.push(`Option '${option_name}' must be a number.`);
                    continue;
                }

                if (expected_type === 'string' && actual_type !== 'string') {
                    errors.push(`Option '${option_name}' must be a string.`);
                    continue;
                }
            }

            // Validate based on type
            if (typeof value === 'string') {
                const string_validation = this.validate_input(value, rules);
                if (!string_validation.valid) {
                    errors.push(...string_validation.errors.map((e) => `${option_name}: ${e}`));
                }
            } else if (typeof value === 'number') {
                if (rules.min !== undefined && value < rules.min) {
                    errors.push(`Option '${option_name}' must be at least ${rules.min}.`);
                }
                if (rules.max !== undefined && value > rules.max) {
                    errors.push(`Option '${option_name}' must be at most ${rules.max}.`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Validate permissions
     * @param {GuildMember} member - Guild member
     * @param {Array} required_permissions - Required permissions
     * @returns {Object} Validation result
     */
    validate_permissions(member, required_permissions) {
        if (!member) {
            return {
                valid: false,
                missing: required_permissions,
                message: 'Member not found.',
            };
        }

        const missing = required_permissions.filter(
            (perm) => !member.permissions.has(perm)
        );

        return {
            valid: missing.length === 0,
            missing,
            message:
                missing.length > 0
                    ? `Missing permissions: ${missing.join(', ')}`
                    : 'All permissions satisfied.',
        };
    }

    /**
     * Validate and throw if invalid
     * @param {Object} validation_result - Validation result
     * @param {string} context - Error context
     * @throws {ValidationError} If validation fails
     */
    throw_if_invalid(validation_result, context = 'Validation failed') {
        if (!validation_result.valid) {
            throw new ValidationError(
                validation_result.errors.join(' ') || context,
                {
                    errors: validation_result.errors,
                }
            );
        }
    }

    /**
     * Validate that a member is in a voice channel and return it
     * @param {GuildMember} member
     * @returns {VoiceChannel|StageChannel}
     * @throws {ValidationError} if not in a voice channel
     */
    validateVoiceChannel(member) {
        const channel = member?.voice?.channel;
        if (!channel) {
            throw new ValidationError('You need to join a voice channel first.');
        }
        return channel;
    }

    /**
     * Validate bot permissions in a voice channel (CONNECT & SPEAK)
     * @param {VoiceChannel|StageChannel} channel
     * @param {Guild} guild
     * @throws {ValidationError} if missing permissions
     */
    validateBotPermissions(channel, guild) {
        const me = guild?.members?.me;
        if (!me) {
            throw new ValidationError('Bot member is not available in this guild.');
        }

        const perms = me.permissionsIn(channel);
        const missing = [];
        if (!perms.has(PermissionFlagsBits.Connect)) missing.push('CONNECT');
        if (!perms.has(PermissionFlagsBits.Speak)) missing.push('SPEAK');

        if (missing.length > 0) {
            throw new ValidationError(`Missing voice permissions: ${missing.join(', ')}`);
        }
    }
}

module.exports = new ValidationHelper();
