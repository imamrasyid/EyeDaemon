/**
 * ArgumentParser Helper
 * 
 * Parses command arguments from prefix commands into structured options
 * that match the format expected by controllers (similar to slash command options)
 */

// Discord option types
const OptionType = {
    SUB_COMMAND: 1,
    SUB_COMMAND_GROUP: 2,
    STRING: 3,
    INTEGER: 4,
    BOOLEAN: 5,
    USER: 6,
    CHANNEL: 7,
    ROLE: 8,
    MENTIONABLE: 9,
    NUMBER: 10,
};

class ArgumentParser {
    /**
     * Parse raw arguments into structured options based on command definition
     * @param {string[]} args - Raw arguments from message
     * @param {Object} command - Command definition with options
     * @param {Object} guild - Guild context for resolving mentions
     * @returns {Map<string, any>} Parsed options
     */
    static parse(args, command, guild) {
        const parsedOptions = new Map();

        if (!args || args.length === 0) {
            return parsedOptions;
        }

        // Handle subcommands first
        if (command.options && command.options.length > 0) {
            const firstOption = command.options[0];

            // Check if first option is a subcommand or subcommand group
            if (firstOption.type === OptionType.SUB_COMMAND ||
                firstOption.type === OptionType.SUB_COMMAND_GROUP) {

                const subcommandName = args[0]?.toLowerCase();
                const subcommand = command.options.find(opt => opt.name === subcommandName);

                if (subcommand) {
                    if (subcommand.type === OptionType.SUB_COMMAND) {
                        parsedOptions.set('subcommand', subcommandName);
                        // Parse subcommand options
                        const subArgs = args.slice(1);
                        return this.parseOptions(subArgs, subcommand.options || [], guild, parsedOptions);
                    } else if (subcommand.type === OptionType.SUB_COMMAND_GROUP) {
                        parsedOptions.set('subcommandGroup', subcommandName);
                        // Parse nested subcommand
                        if (args.length > 1 && subcommand.options) {
                            const nestedSubcommandName = args[1]?.toLowerCase();
                            const nestedSubcommand = subcommand.options.find(opt => opt.name === nestedSubcommandName);

                            if (nestedSubcommand) {
                                parsedOptions.set('subcommand', nestedSubcommandName);
                                const subArgs = args.slice(2);
                                return this.parseOptions(subArgs, nestedSubcommand.options || [], guild, parsedOptions);
                            }
                        }
                    }
                }
            }
        }

        // Parse regular options
        return this.parseOptions(args, command.options || [], guild, parsedOptions);
    }

    /**
     * Parse options from arguments
     * @param {string[]} args - Arguments to parse
     * @param {Array} optionDefinitions - Option definitions from command
     * @param {Object} guild - Guild context
     * @param {Map} parsedOptions - Map to store parsed options
     * @returns {Map<string, any>} Parsed options
     */
    static parseOptions(args, optionDefinitions, guild, parsedOptions) {
        // First, handle quoted strings
        const processedArgs = this.parseQuotedStrings(args);

        let argIndex = 0;

        for (const optionDef of optionDefinitions) {
            if (argIndex >= processedArgs.length) {
                // No more arguments available
                break;
            }

            const rawValue = processedArgs[argIndex];

            // Parse and convert the value based on type
            const parsedValue = this.parseValue(rawValue, optionDef.type, guild);

            if (parsedValue !== null) {
                parsedOptions.set(optionDef.name, parsedValue);
                argIndex++;
            } else if (optionDef.required) {
                // Required option but couldn't parse - still increment to avoid getting stuck
                argIndex++;
            }
        }

        return parsedOptions;
    }

    /**
     * Parse quoted strings in arguments
     * Handles both single and double quotes
     * @param {string[]} args - Raw arguments
     * @returns {string[]} Parsed arguments with quotes handled
     */
    static parseQuotedStrings(args) {
        const result = [];
        let currentArg = '';
        let inQuotes = false;
        let quoteChar = null;

        for (const arg of args) {
            if (!inQuotes) {
                // Check if this arg starts with a quote
                if ((arg.startsWith('"') || arg.startsWith("'")) && arg.length > 1) {
                    quoteChar = arg[0];

                    // Check if quote also ends in this arg
                    if (arg.endsWith(quoteChar) && arg.length > 1) {
                        // Complete quoted string in single arg
                        result.push(arg.slice(1, -1));
                    } else {
                        // Start of quoted string
                        inQuotes = true;
                        currentArg = arg.slice(1);
                    }
                } else {
                    // Regular arg
                    result.push(arg);
                }
            } else {
                // We're inside quotes
                if (arg.endsWith(quoteChar)) {
                    // End of quoted string
                    currentArg += ' ' + arg.slice(0, -1);
                    result.push(currentArg);
                    currentArg = '';
                    inQuotes = false;
                    quoteChar = null;
                } else {
                    // Continue building quoted string
                    currentArg += ' ' + arg;
                }
            }
        }

        // If we're still in quotes at the end, add what we have
        if (inQuotes && currentArg) {
            result.push(currentArg);
        }

        return result;
    }

    /**
     * Parse a single value based on its type
     * @param {string} value - Value to parse
     * @param {number} type - Discord option type
     * @param {Object} guild - Guild context for resolving mentions
     * @returns {any} Parsed value or null
     */
    static parseValue(value, type, guild) {
        if (!value) return null;

        switch (type) {
            case OptionType.STRING:
                return value;

            case OptionType.INTEGER:
                return this.parseInteger(value);

            case OptionType.BOOLEAN:
                return this.parseBoolean(value);

            case OptionType.NUMBER:
                return this.parseNumber(value);

            case OptionType.USER:
            case OptionType.MENTIONABLE:
                return this.parseUser(value, guild);

            case OptionType.CHANNEL:
                return this.parseChannel(value, guild);

            case OptionType.ROLE:
                return this.parseRole(value, guild);

            default:
                return value;
        }
    }

    /**
     * Parse integer value
     * @param {string} value - Value to parse
     * @returns {number|null} Parsed integer or null
     */
    static parseInteger(value) {
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? null : parsed;
    }

    /**
     * Parse boolean value
     * @param {string} value - Value to parse
     * @returns {boolean|null} Parsed boolean or null
     */
    static parseBoolean(value) {
        const lower = value.toLowerCase();

        if (lower === 'true' || lower === 'yes' || lower === '1' || lower === 'on') {
            return true;
        }

        if (lower === 'false' || lower === 'no' || lower === '0' || lower === 'off') {
            return false;
        }

        return null;
    }

    /**
     * Parse number value (float)
     * @param {string} value - Value to parse
     * @returns {number|null} Parsed number or null
     */
    static parseNumber(value) {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? null : parsed;
    }

    /**
     * Parse user mention
     * @param {string} value - Value to parse (mention or ID)
     * @param {Object} guild - Guild context
     * @returns {Object|null} User object or null
     */
    static parseUser(value, guild) {
        if (!guild) return null;

        // Extract ID from mention format <@123456> or <@!123456>
        const userId = value.replace(/[<@!>]/g, '');

        // Try to get member from guild cache
        const member = guild.members.cache.get(userId);
        return member?.user || null;
    }

    /**
     * Parse channel mention
     * @param {string} value - Value to parse (mention or ID)
     * @param {Object} guild - Guild context
     * @returns {Object|null} Channel object or null
     */
    static parseChannel(value, guild) {
        if (!guild) return null;

        // Extract ID from mention format <#123456>
        const channelId = value.replace(/[<#>]/g, '');

        // Try to get channel from guild cache
        return guild.channels.cache.get(channelId) || null;
    }

    /**
     * Parse role mention
     * @param {string} value - Value to parse (mention or ID)
     * @param {Object} guild - Guild context
     * @returns {Object|null} Role object or null
     */
    static parseRole(value, guild) {
        if (!guild) return null;

        // Extract ID from mention format <@&123456>
        const roleId = value.replace(/[<@&>]/g, '');

        // Try to get role from guild cache
        return guild.roles.cache.get(roleId) || null;
    }

    /**
     * Validate that all required options are present
     * @param {Map<string, any>} parsedOptions - Parsed options
     * @param {Object} command - Command definition
     * @throws {Error} If required option is missing
     */
    static validate(parsedOptions, command) {
        if (!command.options) return;

        // Get the relevant options to validate
        let optionsToValidate = command.options;

        // If there's a subcommand, validate its options instead
        const subcommand = parsedOptions.get('subcommand');
        const subcommandGroup = parsedOptions.get('subcommandGroup');

        if (subcommandGroup) {
            // Find the subcommand group
            const group = command.options.find(opt =>
                opt.name === subcommandGroup && opt.type === OptionType.SUB_COMMAND_GROUP
            );

            if (group && subcommand) {
                // Find the nested subcommand
                const nestedSubcommand = group.options?.find(opt =>
                    opt.name === subcommand && opt.type === OptionType.SUB_COMMAND
                );

                if (nestedSubcommand) {
                    optionsToValidate = nestedSubcommand.options || [];
                }
            }
        } else if (subcommand) {
            // Find the subcommand
            const subcommandDef = command.options.find(opt =>
                opt.name === subcommand && opt.type === OptionType.SUB_COMMAND
            );

            if (subcommandDef) {
                optionsToValidate = subcommandDef.options || [];
            }
        }

        // Validate required options
        for (const option of optionsToValidate) {
            // Skip subcommands and subcommand groups in validation
            if (option.type === OptionType.SUB_COMMAND ||
                option.type === OptionType.SUB_COMMAND_GROUP) {
                continue;
            }

            if (option.required && !parsedOptions.has(option.name)) {
                throw new Error(
                    `Missing required option: \`${option.name}\`\n` +
                    `Description: ${option.description || 'No description'}`
                );
            }
        }
    }

    /**
     * Get usage string for a command
     * @param {Object} command - Command definition
     * @returns {string} Usage string
     */
    static getUsageString(command, prefix = '!') {
        let usage = `${prefix}${command.name}`;

        if (!command.options || command.options.length === 0) {
            return usage;
        }

        // Check if command has subcommands
        const hasSubcommands = command.options.some(opt =>
            opt.type === OptionType.SUB_COMMAND || opt.type === OptionType.SUB_COMMAND_GROUP
        );

        if (hasSubcommands) {
            const subcommandNames = command.options
                .filter(opt => opt.type === OptionType.SUB_COMMAND || opt.type === OptionType.SUB_COMMAND_GROUP)
                .map(opt => opt.name)
                .join('|');
            usage += ` <${subcommandNames}>`;
        } else {
            // Add regular options
            for (const option of command.options) {
                if (option.required) {
                    usage += ` <${option.name}>`;
                } else {
                    usage += ` [${option.name}]`;
                }
            }
        }

        return usage;
    }
}

module.exports = ArgumentParser;
