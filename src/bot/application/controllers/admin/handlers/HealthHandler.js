/**
 * HealthHandler
 * 
 * Handles health check command with ResponseHelper.
 */

const ResponseHelper = require('../../../../system/helpers/ResponseHelper');

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
            await interaction.deferReply();

            const healthCheckService = this.controller.client.healthCheckService;

            if (!healthCheckService) {
                const embed = ResponseHelper.error('Health Check Unavailable', 'Health check service is not active.');
                return await ResponseHelper.send(interaction, embed);
            }

            const healthResult = await healthCheckService.checkHealth();

            let embedColor;
            let statusEmoji;
            switch (healthResult.status) {
                case 'healthy':
                    embedColor = ResponseHelper.THEMES.SUCCESS;
                    statusEmoji = '✅';
                    break;
                case 'degraded':
                    embedColor = ResponseHelper.THEMES.WARNING;
                    statusEmoji = '⚠️';
                    break;
                case 'unhealthy':
                    embedColor = ResponseHelper.THEMES.ERROR;
                    statusEmoji = '❌';
                    break;
                default:
                    embedColor = ResponseHelper.THEMES.DARK;
                    statusEmoji = '❓';
            }

            const embed = ResponseHelper.createEmbed({
                color: embedColor,
                title: `${statusEmoji} EyeDaemon Unified Health Check`,
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
                const dbStatus = db.status === 'healthy' ? '✅' : db.status === 'degraded' ? '⚠️' : '❌';
                const dbValue = [
                    `**Status:** ${dbStatus} \`${db.status}\``,
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
            await this.controller.safeReplyError(interaction, 'Failed to perform health check');
        }
    }
}

module.exports = HealthHandler;
