/**
 * Help Music Button Interaction
 * 
 * Displays music commands when the music category button is clicked.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class HelpMusicButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'help_music',
            type: 'button',
        });
    }

    async execute(interaction) {
        try {
            // Get music module commands
            const musicModule = this.client.modules.get('music');
            if (!musicModule) {
                return await this.sendError(interaction, 'Music module not found!');
            }

            const commands = musicModule.commands || [];

            // Format commands into fields
            const commandFields = this.formatCommands(commands);

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('🎵 Music Commands')
                .setDescription('Control music playback and manage playlists')
                .addFields(commandFields)
                .setFooter({ text: 'Click a category button to view other commands' })
                .setTimestamp();

            // Create back button
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('help_back')
                        .setLabel('← Back to Categories')
                        .setStyle(ButtonStyle.Secondary)
                );

            // Acknowledge first to clear loading, then edit
            await interaction.deferUpdate();
            await interaction.editReply({ embeds: [embed], components: [row] });

            this.log(`Displayed music help for user ${interaction.user.tag}`, 'info');
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }

    /**
     * Format commands into embed fields with detailed information
     * @param {Array} commands - Array of command objects
     * @returns {Array} Array of embed fields
     */
    formatCommands(commands) {
        const fields = [];

        for (const cmd of commands) {
            const usage = this.formatUsage(cmd);

            // Build detailed description
            let description = `${cmd.description}\n\n`;

            // Add usage
            if (usage.includes('\n')) {
                // Multiple subcommands
                description += `**Subcommands:**\n\`\`\`\n${usage}\n\`\`\``;
            } else {
                description += `**Usage:** \`${usage}\`\n`;
            }

            // Add parameter details if available
            if (cmd.options && cmd.options.length > 0) {
                const hasSubcommands = cmd.options.some(opt => opt.type === 1);

                if (!hasSubcommands) {
                    description += `\n**Parameters:**\n`;
                    cmd.options.forEach(opt => {
                        const required = opt.required ? '(Required)' : '(Optional)';
                        const typeMap = {
                            3: 'Text',
                            4: 'Number',
                            5: 'Boolean',
                            6: 'User',
                            7: 'Channel',
                            8: 'Role',
                            10: 'Number'
                        };
                        const type = typeMap[opt.type] || 'Unknown';
                        description += `• \`${opt.name}\` ${required} - ${opt.description} [${type}]\n`;
                    });
                }
            }

            fields.push({
                name: `/${cmd.name}`,
                value: description.trim(),
                inline: false
            });
        }

        return fields;
    }

    /**
     * Format command usage string with detailed parameter information
     * @param {Object} cmd - Command object
     * @returns {string} Formatted usage string with parameters
     */
    formatUsage(cmd) {
        if (!cmd.options || cmd.options.length === 0) {
            return `/${cmd.name}`;
        }

        // Check if command has subcommands
        const hasSubcommands = cmd.options.some(opt => opt.type === 1); // SUB_COMMAND type

        if (hasSubcommands) {
            // Format subcommands
            const subcommands = cmd.options.filter(opt => opt.type === 1);
            return subcommands.map(sub => {
                const subParams = sub.options ? sub.options.map(opt => {
                    return opt.required ? `<${opt.name}>` : `[${opt.name}]`;
                }).join(' ') : '';
                return `/${cmd.name} ${sub.name}${subParams ? ' ' + subParams : ''}`;
            }).join('\n');
        }

        // Format regular parameters
        const params = cmd.options.map(opt => {
            return opt.required ? `<${opt.name}>` : `[${opt.name}]`;
        }).join(' ');

        return `/${cmd.name} ${params}`;
    }
}

module.exports = HelpMusicButton;
