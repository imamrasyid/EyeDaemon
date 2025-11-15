/**
 * CommandVerifier Helper
 * 
 * Verifies that all commands in the module registry are properly configured
 * and compatible with prefix command execution.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger_helper');

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
    ATTACHMENT: 11,
};

// Supported option types for prefix commands
const SUPPORTED_TYPES = [
    OptionType.STRING,
    OptionType.INTEGER,
    OptionType.BOOLEAN,
    OptionType.USER,
    OptionType.CHANNEL,
    OptionType.ROLE,
    OptionType.NUMBER,
    OptionType.SUB_COMMAND,
    OptionType.SUB_COMMAND_GROUP,
];

class CommandVerifier {
    /**
     * Verify all commands in module registry
     * @param {Object} client - Discord client with loaded modules and controllers
     * @returns {Object} Verification report
     */
    static verifyAll(client) {
        const report = {
            total: 0,
            valid: 0,
            invalid: [],
            warnings: [],
        };

        if (!client.modules || client.modules.size === 0) {
            report.warnings.push({
                type: 'NO_MODULES',
                message: 'No modules loaded in client',
            });
            return report;
        }

        // Iterate through all modules
        for (const [moduleName, module] of client.modules) {
            if (!module.commands || module.commands.length === 0) {
                report.warnings.push({
                    type: 'NO_COMMANDS',
                    module: moduleName,
                    message: `Module ${moduleName} has no commands`,
                });
                continue;
            }

            // Verify each command in the module
            for (const command of module.commands) {
                report.total++;

                const result = this.verifyCommand(command, client, moduleName);

                if (result.valid) {
                    report.valid++;
                } else {
                    report.invalid.push({
                        module: moduleName,
                        command: command.name,
                        errors: result.errors,
                    });
                }

                // Add warnings to report
                if (result.warnings.length > 0) {
                    for (const warning of result.warnings) {
                        report.warnings.push({
                            module: moduleName,
                            command: command.name,
                            ...warning,
                        });
                    }
                }
            }
        }

        return report;
    }

    /**
     * Verify single command
     * @param {Object} command - Command definition
     * @param {Object} client - Discord client with loaded controllers
     * @param {string} moduleName - Name of the module containing the command
     * @returns {Object} Verification result
     */
    static verifyCommand(command, client, moduleName = 'unknown') {
        const result = {
            valid: true,
            errors: [],
            warnings: [],
        };

        // Check required fields
        if (!command.name) {
            result.valid = false;
            result.errors.push('Missing required field: name');
        }

        if (!command.controller) {
            result.valid = false;
            result.errors.push('Missing required field: controller');
        }

        if (!command.method) {
            result.valid = false;
            result.errors.push('Missing required field: method');
        }

        // If basic fields are missing, return early
        if (!result.valid) {
            return result;
        }

        // Check if controller exists
        if (client && client.controllers) {
            const controller = client.controllers.get(command.controller);
            if (!controller) {
                result.valid = false;
                result.errors.push(`Controller not found: ${command.controller}`);
            } else {
                // Check if method exists on controller
                if (typeof controller[command.method] !== 'function') {
                    result.valid = false;
                    result.errors.push(
                        `Method ${command.method} not found on controller ${command.controller}`
                    );
                }
            }
        }

        // Check if command is compatible with prefix
        const compatibilityResult = this.isCompatibleWithPrefix(command);
        if (!compatibilityResult.compatible) {
            result.warnings.push({
                type: 'PREFIX_INCOMPATIBLE',
                message: compatibilityResult.reason,
            });
        }

        // Check option types
        if (command.options && command.options.length > 0) {
            this.validateOptions(command.options, result, command.name);
        }

        return result;
    }

    /**
     * Validate command options recursively
     * @param {Array} options - Command options
     * @param {Object} result - Result object to add errors/warnings to
     * @param {string} commandName - Command name for context
     * @param {number} depth - Current depth (for subcommands)
     */
    static validateOptions(options, result, commandName, depth = 0) {
        for (const option of options) {
            // Check if option has required fields
            if (!option.name) {
                result.errors.push(`Option missing name in command ${commandName}`);
                result.valid = false;
                continue;
            }

            if (option.type === undefined || option.type === null) {
                result.errors.push(`Option ${option.name} missing type in command ${commandName}`);
                result.valid = false;
                continue;
            }

            // Check if option type is supported
            if (!SUPPORTED_TYPES.includes(option.type)) {
                result.warnings.push({
                    type: 'UNSUPPORTED_OPTION_TYPE',
                    option: option.name,
                    optionType: option.type,
                    message: `Option ${option.name} has unsupported type ${option.type} (ATTACHMENT not supported in prefix commands)`,
                });
            }

            // Validate subcommand structure
            if (option.type === OptionType.SUB_COMMAND || option.type === OptionType.SUB_COMMAND_GROUP) {
                if (depth > 0) {
                    result.errors.push(
                        `Invalid subcommand nesting in ${commandName}: subcommands cannot be nested more than one level deep`
                    );
                    result.valid = false;
                }

                // Recursively validate subcommand options
                if (option.options && option.options.length > 0) {
                    this.validateOptions(option.options, result, commandName, depth + 1);
                }
            }

            // Check for choices validation
            if (option.choices && option.choices.length > 0) {
                if (option.type !== OptionType.STRING && option.type !== OptionType.INTEGER && option.type !== OptionType.NUMBER) {
                    result.warnings.push({
                        type: 'INVALID_CHOICES',
                        option: option.name,
                        message: `Option ${option.name} has choices but type is not STRING, INTEGER, or NUMBER`,
                    });
                }
            }

            // Check for min/max value validation
            if ((option.min_value !== undefined || option.max_value !== undefined)) {
                if (option.type !== OptionType.INTEGER && option.type !== OptionType.NUMBER) {
                    result.warnings.push({
                        type: 'INVALID_MIN_MAX',
                        option: option.name,
                        message: `Option ${option.name} has min/max values but type is not INTEGER or NUMBER`,
                    });
                }
            }
        }
    }

    /**
     * Check if command options are compatible with Message Adapter
     * @param {Object} command - Command definition
     * @returns {Object} Compatibility result
     */
    static isCompatibleWithPrefix(command) {
        const result = {
            compatible: true,
            reason: null,
        };

        if (!command.options || command.options.length === 0) {
            return result;
        }

        // Check for unsupported option types
        for (const option of command.options) {
            // ATTACHMENT type is not supported in prefix commands
            if (option.type === OptionType.ATTACHMENT) {
                result.compatible = false;
                result.reason = `Command uses ATTACHMENT option type which is not supported in prefix commands`;
                return result;
            }

            // Check subcommand options recursively
            if (option.type === OptionType.SUB_COMMAND || option.type === OptionType.SUB_COMMAND_GROUP) {
                if (option.options && option.options.length > 0) {
                    const subResult = this.isCompatibleWithPrefix({ options: option.options });
                    if (!subResult.compatible) {
                        return subResult;
                    }
                }
            }
        }

        return result;
    }

    /**
     * Format verification report as readable text
     * @param {Object} report - Verification report from verifyAll()
     * @returns {string} Formatted report
     */
    static formatReport(report) {
        const lines = [];

        lines.push('='.repeat(60));
        lines.push('COMMAND VERIFICATION REPORT');
        lines.push('='.repeat(60));
        lines.push('');

        // Summary
        lines.push('SUMMARY:');
        lines.push(`  Total Commands: ${report.total}`);
        lines.push(`  Valid Commands: ${report.valid}`);
        lines.push(`  Invalid Commands: ${report.invalid.length}`);
        lines.push(`  Warnings: ${report.warnings.length}`);
        lines.push('');

        // Invalid commands
        if (report.invalid.length > 0) {
            lines.push('INVALID COMMANDS:');
            lines.push('-'.repeat(60));
            for (const invalid of report.invalid) {
                lines.push(`  [${invalid.module}] ${invalid.command}`);
                for (const error of invalid.errors) {
                    lines.push(`    ❌ ${error}`);
                }
                lines.push('');
            }
        }

        // Warnings
        if (report.warnings.length > 0) {
            lines.push('WARNINGS:');
            lines.push('-'.repeat(60));
            for (const warning of report.warnings) {
                if (warning.command) {
                    lines.push(`  [${warning.module}] ${warning.command}`);
                    lines.push(`    ⚠️  ${warning.message || warning.type}`);
                } else {
                    lines.push(`  [${warning.module || 'GLOBAL'}]`);
                    lines.push(`    ⚠️  ${warning.message || warning.type}`);
                }
                lines.push('');
            }
        }

        // Success message
        if (report.invalid.length === 0 && report.warnings.length === 0) {
            lines.push('✅ All commands are valid and compatible with prefix execution!');
            lines.push('');
        }

        lines.push('='.repeat(60));

        return lines.join('\n');
    }

    /**
     * Run verification and log results
     * @param {Object} client - Discord client with loaded modules and controllers
     * @returns {Object} Verification report
     */
    static runVerification(client) {
        logger.info('Running command verification...');

        const report = this.verifyAll(client);
        const formattedReport = this.formatReport(report);

        // Log to console
        console.log('\n' + formattedReport);

        // Log to file
        logger.info('Command verification complete', {
            total: report.total,
            valid: report.valid,
            invalid: report.invalid.length,
            warnings: report.warnings.length,
        });

        return report;
    }
}

module.exports = CommandVerifier;
