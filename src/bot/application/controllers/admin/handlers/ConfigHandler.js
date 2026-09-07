'use strict';

/**
 * ConfigHandler
 *
 * Handles guild configuration commands: view, set, reset, list.
 * Uses constants for display labels and format-based value rendering.
 */

const ResponseHelper = require('../../../../system/helpers/ResponseHelper');
const { CATEGORY_LABELS, STATUS_LABELS, formatConfigValue } = require('../../../modules/admin/constants');

class ConfigHandler {
    constructor(controller) {
        this.controller = controller;
    }

    /**
     * Config command router
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
            if (!interaction.deferred && !interaction.replied) {
                await this.controller.safeReplyError(interaction, 'Failed to manage configuration');
            }
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
                `**DJ Role:** ${formatConfigValue('role', config.dj_role)}`,
                `**Default Volume:** \`${config.volume_default}%\``,
                `**Max Queue Size:** \`${config.max_queue_size} tracks\``,
            ].join('\n');

            const welcomeGoodbyeValue = [
                `**Welcome System:** ${formatConfigValue('boolean', config.welcome_enabled)}`,
                `**Welcome Channel:** ${formatConfigValue('channel', config.welcome_channel)}`,
                `**Auto Role:** ${formatConfigValue('role', config.auto_role)}`,
                `**Goodbye System:** ${formatConfigValue('boolean', config.goodbye_enabled)}`,
                `**Goodbye Channel:** ${formatConfigValue('channel', config.goodbye_channel)}`,
            ].join('\n');

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.ADMIN,
                title: `⚙️ Configuration Settings • ${interaction.guild.name}`,
                description: 'Use `/config set <setting> <value>` to change or `/config list` to view all available keys.\n',
                fields: [
                    { name: CATEGORY_LABELS.general, value: `**Prefix:** \`${config.prefix || '!'}\``, inline: false },
                    { name: CATEGORY_LABELS.music, value: musicValue, inline: false },
                    { name: CATEGORY_LABELS.welcome, value: welcomeGoodbyeValue, inline: false },
                    { name: CATEGORY_LABELS.moderation, value: `**Log Channel:** ${formatConfigValue('channel', config.moderation_log_channel)}`, inline: false },
                    { name: CATEGORY_LABELS.logging, value: [
                        `**Enabled:** ${formatConfigValue('boolean', config.logging_enabled)}`,
                        `**Channel:** ${formatConfigValue('channel', config.logging_channel)}`,
                        `**Events:** \`${config.logging_events}\``,
                    ].join('\n'), inline: false },
                    { name: CATEGORY_LABELS.roles, value: [
                        `**Admin Role:** ${formatConfigValue('role', config.admin_role)}`,
                        `**Moderator Role:** ${formatConfigValue('role', config.moderator_role)}`,
                    ].join('\n'), inline: false },
                    { name: CATEGORY_LABELS.leveling, value: `**XP Multiplier:** \`${config.leveling_xp_multiplier}x\``, inline: false },
                    { name: CATEGORY_LABELS.economy, value: `**Starting Balance:** \`${config.economy_starting_balance}\``, inline: false },
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

            const metadata = this.controller.guildConfigService.settingRegistry.get(setting);
            const format = metadata?.format || metadata?.type || 'text';
            const displayValue = formatConfigValue(format, newValue);

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
            await this.controller.safeReplyError(interaction, 'Failed to update configuration');
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

            await this.controller.guildConfigService.resetSetting(guildId, setting);

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

            const fields = [];
            for (const [category, settings] of Object.entries(settingsByCategory)) {
                const categoryName = CATEGORY_LABELS[category] || category.toUpperCase();
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
