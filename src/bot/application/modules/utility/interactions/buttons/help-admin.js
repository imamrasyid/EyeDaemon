/**
 * Help Admin Button Interaction
 * 
 * Displays admin commands when the admin category button is clicked.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class HelpAdminButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'help_admin',
            type: 'button',
        });
    }

    async execute(interaction) {
        try {
            // Get admin module commands
            const adminModule = this.client.modules.get('admin');
            if (!adminModule) {
                return await this.sendError(interaction, 'Admin module not found!');
            }

            const commands = adminModule.commands || [];

            // Format commands into fields
            const commandFields = this.formatCommands(commands);

            const embed = new EmbedBuilder()
                .setColor(0xe67e22)
                .setTitle('⚙️ Admin Commands')
                .setDescription('Server configuration and administrative tools\n\n⚠️ **Administrator permission required**')
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

            this.log(`Displayed admin help for user ${interaction.user.tag}`, 'info');
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

module.exports = HelpAdminButton;
