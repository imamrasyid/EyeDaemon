'use strict';

/**
 * HealthHandler
 *
 * Handles health check command with ResponseHelper.
 * Uses HEALTH_STATUS constant for consistent status display.
 */

const ResponseHelper = require('../../../../system/helpers/ResponseHelper');
const { HEALTH_STATUS } = require('../../../modules/admin/constants');

class HealthHandler {
    constructor(controller) {
        this.controller = controller;
    }

    /**
     * Health command handler
     * Displays comprehensive health check status
     * @param {Object} interaction - Discord interaction
     */
    async health(interaction) {
        try {
            if (!interaction.member.permissions.has('Administrator')) {
                return await this.controller.sendError(
                    interaction,
                    'You need **Administrator** permission to use this command.',
                    true
                );
            }

            await interaction.deferReply();

            const healthCheckService = this.controller.client.services?.get('HealthCheckService')
                || this.controller.client.healthCheckService;

            if (!healthCheckService) {
                const embed = ResponseHelper.error('Health Check Unavailable', 'Health check service is not active.');
                return await ResponseHelper.send(interaction, embed);
            }

            const healthResult = await healthCheckService.checkHealth();
            const statusInfo = HEALTH_STATUS[healthResult.status] || HEALTH_STATUS.unknown;

            const embed = ResponseHelper.createEmbed({
                color: statusInfo.emoji === '✅' ? ResponseHelper.THEMES.SUCCESS
                    : statusInfo.emoji === '⚠️' ? ResponseHelper.THEMES.WARNING
                    : statusInfo.emoji === '❌' ? ResponseHelper.THEMES.ERROR
                    : ResponseHelper.THEMES.DARK,
                title: `${statusInfo.emoji} EyeDaemon Unified Health Check`,
                description: `Overall System Status: **${healthResult.status.toUpperCase()}**`,
                fields: [
                    { name: '⏱️ Latency / Ping', value: `\`${healthResult.responseTime}ms\``, inline: true },
                    { name: '🔄 Failures', value: `\`${healthResult.consecutiveFailures}\``, inline: true },
                ],
                footerText: 'System Diagnostic Report',
                timestamp: healthResult.timestamp,
            });

            if (healthResult.checks.database) {
                const db = healthResult.checks.database;
                const dbStatusInfo = HEALTH_STATUS[db.status] || HEALTH_STATUS.unknown;
                const dbValue = [
                    `**Status:** ${dbStatusInfo.emoji} \`${db.status}\``,
                    `**Connected:** ${db.isConnected ? 'Yes' : 'No'}`,
                    `**Response Time:** \`${db.responseTime}ms\``,
                    db.queryTime ? `**Query Time:** \`${db.queryTime}ms\`` : '',
                ].filter(Boolean).join('\n');

                embed.addFields({
                    name: '🗄️ LibSQL / SQLite Database',
                    value: dbValue,
                    inline: false,
                });
            }

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.controller.log(`Error in health command: ${error.message}`, 'error', {
                stack: error.stack,
            });
            if (!interaction.deferred && !interaction.replied) {
                await this.controller.safeReplyError(interaction, 'Failed to perform health check');
            }
        }
    }
}

module.exports = HealthHandler;
