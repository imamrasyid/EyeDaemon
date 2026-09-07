'use strict';

/**
 * LoggingHandler
 *
 * Handles logging configuration commands: channel, events, view.
 * Manages where and what bot events are logged.
 */

const ResponseHelper = require('../../../../system/helpers/ResponseHelper');
const { formatConfigValue } = require('../../../modules/admin/constants');

class LoggingHandler {
    constructor(controller) {
        this.controller = controller;
    }

    /**
     * Logging command router
     */
    async logs(interaction) {
        try {
            if (!interaction.member.permissions.has('Administrator')) {
                return await this.controller.sendError(interaction, 'You need **Administrator** permission to use this command.', true);
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'view':
                    await this.logsView(interaction);
                    break;
                case 'channel':
                    await this.logsChannel(interaction);
                    break;
                case 'events':
                    await this.logsEvents(interaction);
                    break;
                default:
                    await this.controller.sendError(interaction, 'Unknown subcommand', true);
            }
        } catch (error) {
            this.controller.log(`Error in logs command: ${error.message}`, 'error', {
                stack: error.stack
            });
            if (!interaction.deferred && !interaction.replied) {
                await this.controller.safeReplyError(interaction, 'Failed to manage logging configuration');
            }
        }
    }

    /**
     * View current logging configuration
     */
    async logsView(interaction) {
        try {
            await interaction.deferReply();

            if (!this.controller.guildConfigService) {
                const embed = ResponseHelper.error('Service Unavailable', 'GuildConfigService is not available.');
                return await ResponseHelper.send(interaction, embed);
            }

            const guildId = interaction.guild.id;
            const config = await this.controller.guildConfigService.getGuildConfig(guildId);

            const value = [
                `**Logging Enabled:** ${formatConfigValue('boolean', config.logging_enabled)}`,
                `**Log Channel:** ${formatConfigValue('channel', config.logging_channel)}`,
                `**Events Scope:** \`${config.logging_events || 'all'}\``,
            ].join('\n');

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.ADMIN,
                title: '📝 Logging Configuration',
                description: 'Configure where and what bot events are logged.\nUse `/admin logs channel` or `/admin logs events` to modify.',
                fields: [{ name: 'Current Settings', value, inline: false }],
                footerText: `Guild ID: ${guildId}`,
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.controller.log(`Error in logsView: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to view logging configuration');
        }
    }

    /**
     * Set the logging channel
     */
    async logsChannel(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const channel = interaction.options.getChannel('channel');

            await this.controller.guildConfigService.setSetting(guildId, 'logging_channel', channel.id);
            await this.controller.guildConfigService.setSetting(guildId, 'logging_enabled', true);

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.SUCCESS,
                title: '✅ Logging Channel Updated',
                description: `Event logs will now be sent to ${channel}.`,
                fields: [
                    { name: 'Channel', value: `<#${channel.id}>`, inline: true },
                    { name: 'Logging', value: '**Enabled**', inline: true },
                ],
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.controller.log(`Error in logsChannel: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to set logging channel');
        }
    }

    /**
     * Set which events to log
     */
    async logsEvents(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const scope = interaction.options.getString('scope');

            await this.controller.guildConfigService.setSetting(guildId, 'logging_events', scope);

            const scopeLabels = {
                all: 'All events (joins, leaves, moderation, config changes)',
                moderation: 'Moderation actions only (warn, ban, kick, mute)',
                joins: 'Join and leave events only',
                none: 'Logging disabled',
            };

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.SUCCESS,
                title: '✅ Logging Events Updated',
                description: `Event scope set to **${scope}**.`,
                fields: [
                    { name: 'Scope', value: `\`${scope}\``, inline: true },
                    { name: 'Description', value: scopeLabels[scope] || scope, inline: false },
                ],
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.controller.log(`Error in logsEvents: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to set logging events');
        }
    }
}

module.exports = LoggingHandler;
