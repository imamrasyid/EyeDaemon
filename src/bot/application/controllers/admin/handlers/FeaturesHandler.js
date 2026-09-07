'use strict';

/**
 * FeaturesHandler
 *
 * Handles feature toggle commands: view, toggle.
 * Enables or disables bot modules per guild.
 */

const ResponseHelper = require('../../../../system/helpers/ResponseHelper');
const { formatConfigValue } = require('../../../modules/admin/constants');

const FEATURE_MODULES = [
    { key: 'features_music', label: '🎵 Music', module: 'music' },
    { key: 'features_moderation', label: '🛡️ Moderation', module: 'moderation' },
    { key: 'features_economy', label: '💰 Economy', module: 'economy' },
    { key: 'features_leveling', label: '📈 Leveling', module: 'leveling' },
    { key: 'features_tickets', label: '🎫 Tickets', module: 'ticket' },
    { key: 'features_logging', label: '📝 Logging', module: 'logging' },
];

class FeaturesHandler {
    constructor(controller) {
        this.controller = controller;
    }

    /**
     * Features command router
     */
    async features(interaction) {
        try {
            if (!interaction.member.permissions.has('Administrator')) {
                return await this.controller.sendError(interaction, 'You need **Administrator** permission to use this command.', true);
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'view':
                    await this.featuresView(interaction);
                    break;
                case 'toggle':
                    await this.featuresToggle(interaction);
                    break;
                default:
                    await this.controller.sendError(interaction, 'Unknown subcommand', true);
            }
        } catch (error) {
            this.controller.log(`Error in features command: ${error.message}`, 'error', {
                stack: error.stack
            });
            if (!interaction.deferred && !interaction.replied) {
                await this.controller.safeReplyError(interaction, 'Failed to manage feature toggles');
            }
        }
    }

    /**
     * View all feature toggles
     */
    async featuresView(interaction) {
        try {
            await interaction.deferReply();

            if (!this.controller.guildConfigService) {
                const embed = ResponseHelper.error('Service Unavailable', 'GuildConfigService is not available.');
                return await ResponseHelper.send(interaction, embed);
            }

            const guildId = interaction.guild.id;
            const config = await this.controller.guildConfigService.getGuildConfig(guildId);

            const lines = FEATURE_MODULES.map((f) => {
                const enabled = config[f.key] !== false;
                const status = enabled ? '✅' : '❌';
                return `${status} ${f.label} — \`${enabled ? 'Enabled' : 'Disabled'}\``;
            });

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.ADMIN,
                title: '🎛️ Feature Toggles',
                description: 'Enable or disable bot modules for this server.\nUse `/admin features toggle <module>` to change.',
                fields: [{ name: 'Modules', value: lines.join('\n'), inline: false }],
                footerText: `Guild ID: ${guildId}`,
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.controller.log(`Error in featuresView: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to view features');
        }
    }

    /**
     * Toggle a feature module on/off
     */
    async featuresToggle(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const module = interaction.options.getString('module');

            const feature = FEATURE_MODULES.find((f) => f.module === module);
            if (!feature) {
                const embed = ResponseHelper.error('Invalid Module', `Unknown module: \`${module}\`. Use one of: ${FEATURE_MODULES.map(f => f.module).join(', ')}`);
                return await ResponseHelper.send(interaction, embed);
            }

            const config = await this.controller.guildConfigService.getGuildConfig(guildId);
            const currentValue = config[feature.key] !== false;
            const newValue = !currentValue;

            await this.controller.guildConfigService.setSetting(guildId, feature.key, newValue);

            const embed = ResponseHelper.createEmbed({
                color: newValue ? ResponseHelper.THEMES.SUCCESS : ResponseHelper.THEMES.WARNING,
                title: newValue ? '✅ Feature Enabled' : '❌ Feature Disabled',
                description: `${feature.label} has been **${newValue ? 'enabled' : 'disabled'}** for this server.`,
                fields: [
                    { name: 'Module', value: `\`${module}\``, inline: true },
                    { name: 'Status', value: newValue ? '✅ Enabled' : '❌ Disabled', inline: true },
                ],
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.controller.log(`Error in featuresToggle: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to toggle feature');
        }
    }
}

module.exports = FeaturesHandler;
