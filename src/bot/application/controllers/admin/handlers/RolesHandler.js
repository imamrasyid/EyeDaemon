'use strict';

/**
 * RolesHandler
 *
 * Handles role configuration commands: admin, moderator, view.
 * Manages role-based permission assignments for the bot.
 */

const ResponseHelper = require('../../../../system/helpers/ResponseHelper');
const { formatConfigValue } = require('../../../modules/admin/constants');

class RolesHandler {
    constructor(controller) {
        this.controller = controller;
    }

    /**
     * Roles command router
     */
    async roles(interaction) {
        try {
            if (!interaction.member.permissions.has('Administrator')) {
                return await this.controller.sendError(interaction, 'You need **Administrator** permission to use this command.', true);
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'view':
                    await this.rolesView(interaction);
                    break;
                case 'admin':
                    await this.rolesAdmin(interaction);
                    break;
                case 'moderator':
                    await this.rolesModerator(interaction);
                    break;
                case 'dj':
                    await this.rolesDj(interaction);
                    break;
                default:
                    await this.controller.sendError(interaction, 'Unknown subcommand', true);
            }
        } catch (error) {
            this.controller.log(`Error in roles command: ${error.message}`, 'error', {
                stack: error.stack
            });
            if (!interaction.deferred && !interaction.replied) {
                await this.controller.safeReplyError(interaction, 'Failed to manage role configuration');
            }
        }
    }

    /**
     * View current role configuration
     */
    async rolesView(interaction) {
        try {
            await interaction.deferReply();

            if (!this.controller.guildConfigService) {
                const embed = ResponseHelper.error('Service Unavailable', 'GuildConfigService is not available.');
                return await ResponseHelper.send(interaction, embed);
            }

            const guildId = interaction.guild.id;
            const config = await this.controller.guildConfigService.getGuildConfig(guildId);

            const value = [
                `**Admin Role:** ${formatConfigValue('role', config.admin_role)}`,
                `**Moderator Role:** ${formatConfigValue('role', config.moderator_role)}`,
                `**DJ Role:** ${formatConfigValue('role', config.dj_role)}`,
                `**Auto-Assign Role:** ${formatConfigValue('role', config.auto_role)}`,
            ].join('\n');

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.ADMIN,
                title: '🎭 Role Configuration',
                description: 'Manage role assignments for bot permissions.\nUse `/admin roles <type> @role` to update.',
                fields: [{ name: 'Current Roles', value, inline: false }],
                footerText: `Guild ID: ${guildId}`,
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.controller.log(`Error in rolesView: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to view role configuration');
        }
    }

    /**
     * Set the admin role
     */
    async rolesAdmin(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const role = interaction.options.getRole('role');

            await this.controller.guildConfigService.setSetting(guildId, 'admin_role', role.id);

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.SUCCESS,
                title: '✅ Admin Role Updated',
                description: `Admin role set to ${role}.`,
                fields: [
                    { name: 'Role', value: `<@&${role.id}>`, inline: true },
                    { name: 'ID', value: `\`${role.id}\``, inline: true },
                ],
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.controller.log(`Error in rolesAdmin: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to set admin role');
        }
    }

    /**
     * Set the moderator role
     */
    async rolesModerator(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const role = interaction.options.getRole('role');

            await this.controller.guildConfigService.setSetting(guildId, 'moderator_role', role.id);

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.SUCCESS,
                title: '✅ Moderator Role Updated',
                description: `Moderator role set to ${role}.`,
                fields: [
                    { name: 'Role', value: `<@&${role.id}>`, inline: true },
                    { name: 'ID', value: `\`${role.id}\``, inline: true },
                ],
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.controller.log(`Error in rolesModerator: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to set moderator role');
        }
    }

    /**
     * Set the DJ role
     */
    async rolesDj(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const role = interaction.options.getRole('role');

            await this.controller.guildConfigService.setSetting(guildId, 'dj_role', role.id);

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.SUCCESS,
                title: '✅ DJ Role Updated',
                description: `DJ role set to ${role}.`,
                fields: [
                    { name: 'Role', value: `<@&${role.id}>`, inline: true },
                    { name: 'ID', value: `\`${role.id}\``, inline: true },
                ],
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.controller.log(`Error in rolesDj: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to set DJ role');
        }
    }
}

module.exports = RolesHandler;
