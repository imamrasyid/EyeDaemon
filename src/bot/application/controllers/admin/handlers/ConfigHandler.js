/**
 * ConfigHandler
 * 
 * Handles guild configuration commands: view, set, reset, list with ResponseHelper.
 */

const ResponseHelper = require('../../../../system/helpers/ResponseHelper');

class ConfigHandler {
    constructor(controller) {
        this.controller = controller;
    }

    /**
     * Config command handler
     * Manages guild configuration settings
     */
    async config(interaction) {
        try {
            if (!interaction.member.permissions.has('Administrator')) {
                return await this.controller.sendError(interaction, 'You need **Administrator** permission to use this command.', true);
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'view':
                    await this.configView(interaction);
                    break;
                case 'set':
                    await this.configSet(interaction);
                    break;
                case 'reset':
                    await this.configReset(interaction);
                    break;
                case 'list':
                    await this.configList(interaction);
                    break;
                default:
                    await this.controller.sendError(interaction, 'Unknown subcommand', true);
            }
        } catch (error) {
            this.controller.log(`Error in config command: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to manage configuration');
        }
    }

    /**
     * View guild configuration (config view subcommand)
     */
    async configView(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;

            if (!this.controller.guildConfigService) {
                const embed = ResponseHelper.error('Service Unavailable', 'GuildConfigService is not available.');
                return await ResponseHelper.send(interaction, embed);
            }

            const config = await this.controller.guildConfigService.getGuildConfig(guildId);

            const musicValue = [
                `**DJ Role:** ${config.dj_role ? `<@&${config.dj_role}>` : 'Not set'}`,
                `**Default Volume:** \`${config.volume_default}%\``,
                `**Max Queue Size:** \`${config.max_queue_size} tracks\``,
            ].join('\n');

            const welcomeGoodbyeValue = [
                `**Welcome System:** ${config.welcome_enabled ? '✅ Enabled' : '❌ Disabled'}`,
                `**Welcome Channel:** ${config.welcome_channel ? `<#${config.welcome_channel}>` : 'Not set'}`,
                `**Auto Role:** ${config.auto_role ? `<@&${config.auto_role}>` : 'Not set'}`,
                `**Goodbye System:** ${config.goodbye_enabled ? '✅ Enabled' : '❌ Disabled'}`,
                `**Goodbye Channel:** ${config.goodbye_channel ? `<#${config.goodbye_channel}>` : 'Not set'}`,
            ].join('\n');

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.ADMIN,
                title: `⚙️ Configuration Settings • ${interaction.guild.name}`,
                description: 'Use `/config set <setting> <value>` to change or `/config list` to view all available keys.\n',
                fields: [
                    { name: '📋 General Settings', value: `**Prefix:** \`${config.prefix || '!'}\``, inline: false },
                    { name: '🎵 Music Settings', value: musicValue, inline: false },
                    { name: '👋 Welcome & Goodbye Systems', value: welcomeGoodbyeValue, inline: false },
                    { name: '🛡️ Moderation Log Channel', value: config.moderation_log_channel ? `<#${config.moderation_log_channel}>` : 'Not set', inline: false },
                ],
                footerText: `Guild ID: ${guildId}`
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.controller.log(`Error in configView: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to view configuration');
        }
    }

    /**
     * Set guild configuration (config set subcommand)
     */
    async configSet(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const setting = interaction.options.getString('setting');
            const value = interaction.options.getString('value');

            if (!this.controller.guildConfigService) {
                const embed = ResponseHelper.error('Service Unavailable', 'GuildConfigService is not available.');
                return await ResponseHelper.send(interaction, embed);
            }

            await this.controller.guildConfigService.setSetting(guildId, setting, value);
            const newValue = await this.controller.guildConfigService.getSetting(guildId, setting);

            let displayValue = newValue;
            if (setting.includes('role') && newValue) {
                displayValue = `<@&${newValue}>`;
            } else if (setting.includes('channel') && newValue) {
                displayValue = `<#${newValue}>`;
            } else if (typeof newValue === 'boolean') {
                displayValue = newValue ? '✅ Enabled' : '❌ Disabled';
            } else if (newValue === null) {
                displayValue = 'Not set';
            } else {
                displayValue = `\`${newValue}\``;
            }

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.SUCCESS,
                title: '✅ Configuration Updated',
                description: `Successfully modified setting **${setting}**!`,
                fields: [{ name: 'New Value', value: displayValue, inline: false }]
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.controller.log(`Error in configSet: ${error.message}`, 'error', {
                stack: error.stack,
            });
            await this.controller.safeReplyError(interaction, `Failed to update configuration: ${error.message}`);
        }
    }

    /**
     * Reset guild configuration (config reset subcommand)
     */
    async configReset(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const setting = interaction.options.getString('setting');

            if (!this.controller.guildConfigService) {
                const embed = ResponseHelper.error('Service Unavailable', 'GuildConfigService is not available.');
                return await ResponseHelper.send(interaction, embed);
            }

            await this.controller.guildConfigService.resetSetting?.(guildId, setting);

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.WARNING,
                title: '🔄 Configuration Reset',
                description: `Successfully restored setting **${setting}** to its default value.`
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.controller.log(`Error in configReset: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to reset configuration');
        }
    }

    /**
     * List all available settings (config list subcommand)
     */
    async configList(interaction) {
        try {
            await interaction.deferReply();

            if (!this.controller.guildConfigService) {
                const embed = ResponseHelper.error('Service Unavailable', 'GuildConfigService is not available.');
                return await ResponseHelper.send(interaction, embed);
            }

            const settingsByCategory = this.controller.guildConfigService.listAvailableSettings();

            const categoryNames = {
                general: '📋 General Settings',
                music: '🎵 Music Settings',
                welcome: '👋 Welcome & Goodbye Settings',
                moderation: '🛡️ Moderation Settings',
                leveling: '📈 Leveling Settings',
                economy: '💰 Economy Settings',
            };

            const fields = [];
            for (const [category, settings] of Object.entries(settingsByCategory)) {
                const categoryName = categoryNames[category] || category.toUpperCase();
                const settingsText = settings
                    .map(s => `• \`${s.key}\` — ${s.description} *(default: \`${s.default}\`)*`)
                    .join('\n');

                fields.push({
                    name: categoryName,
                    value: settingsText || 'No settings',
                    inline: false,
                });
            }

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.ADMIN,
                title: '📋 Available Configuration Settings',
                description: 'Use `/config set <setting> <value>` to change a setting or `/config reset <setting>` to restore defaults.',
                fields,
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.controller.log(`Error in configList: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to list settings');
        }
    }
}

module.exports = ConfigHandler;
