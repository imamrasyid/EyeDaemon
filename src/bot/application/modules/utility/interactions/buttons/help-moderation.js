/**
 * Help Moderation Button Interaction
 * 
 * Displays moderation commands when the moderation category button is clicked.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class HelpModerationButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'help_moderation',
            type: 'button',
        });
    }

    async execute(interaction) {
        try {
            // Get moderation module commands
            const moderationModule = this.client.modules.get('moderation');
            if (!moderationModule) {
                return await this.sendError(interaction, 'Moderation module not found!');
            }

            const commands = moderationModule.commands || [];

            // Format commands into fields
            const commandFields = this.formatCommands(commands);

            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('🛡️ Moderation Commands')
                .setDescription('Manage your server and moderate members')
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

            await interaction.update({ embeds: [embed], components: [row] });

            this.log(`Displayed moderation help for user ${interaction.user.tag}`, 'info');
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

            let description = `${cmd.description}\n\n`;

            if (usage.includes('\n')) {
                description += `**Subcommands:**\n\`\`\`\n${usage}\n\`\`\``;
            } else {
                description += `**Usage:** \`${usage}\`\n`;
            }

            if (cmd.options && cmd.options.length > 0 && !cmd.options.some(opt => opt.type === 1)) {
                description += `\n**Parameters:**\n`;
                cmd.options.forEach(opt => {
                    const required = opt.required ? '(Required)' : '(Optional)';
                    const typeMap = { 3: 'Text', 4: 'Number', 5: 'Boolean', 6: 'User', 7: 'Channel', 8: 'Role', 10: 'Number' };
                    const type = typeMap[opt.type] || 'Unknown';
                    description += `• \`${opt.name}\` ${required} - ${opt.description} [${type}]\n`;
                });
            }

            fields.push({ name: `/${cmd.name}`, value: description.trim(), inline: false });
        }

        return fields;
    }

    /**
     * Format command usage string with detailed parameter information
     * @param {Object} cmd - Command object
     * @returns {string} Formatted usage string
     */
    formatUsage(cmd) {
        if (!cmd.options || cmd.options.length === 0) return `/${cmd.name}`;

        const hasSubcommands = cmd.options.some(opt => opt.type === 1);
        if (hasSubcommands) {
            return cmd.options.filter(opt => opt.type === 1).map(sub => {
                const subParams = sub.options ? sub.options.map(opt =>
                    opt.required ? `<${opt.name}>` : `[${opt.name}]`
                ).join(' ') : '';
                return `/${cmd.name} ${sub.name}${subParams ? ' ' + subParams : ''}`;
            }).join('\n');
        }

        const params = cmd.options.map(opt => opt.required ? `<${opt.name}>` : `[${opt.name}]`).join(' ');
        return `/${cmd.name} ${params}`;
    }
}

module.exports = HelpModerationButton;
