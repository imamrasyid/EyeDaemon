/**
 * PerformanceHandler
 * 
 * Handles performance metrics command with ResponseHelper.
 */

const ResponseHelper = require('../../../../system/helpers/ResponseHelper');

class PerformanceHandler {
    constructor(controller) {
        this.controller = controller;
    }

    /**
     * Performance command handler
     * Displays bot performance metrics
     * @param {Object} interaction - Discord interaction
     */
    async performance(interaction) {
        try {
            await interaction.deferReply();

            if (!this.controller.performanceService) {
                const embed = ResponseHelper.error('Performance Service Unavailable', 'PerformanceService is not active.');
                return await ResponseHelper.send(interaction, embed);
            }

            const metrics = await this.controller.performanceService.getAllMetrics();

            const systemValue = [
                `**Memory Usage:** \`${metrics.system.memory.heapUsed} / ${metrics.system.memory.heapTotal}\` (${metrics.system.memory.heapUsagePercent}%)`,
                `**CPU Load:** \`${metrics.system.cpu.usage}\` (${metrics.system.cpu.cores} Cores)`,
                `**System Uptime:** \`${metrics.system.system.uptime}\``,
                `**Platform:** \`${metrics.system.system.platform} (${metrics.system.system.arch})\``,
            ].join('\n');

            const botValue = [
                `**Guilds:** \`${metrics.bot.guilds.total}\` (\`${metrics.bot.guilds.available}\` available)`,
                `**Users:** \`${metrics.bot.users.cached}\` cached / \`${metrics.bot.users.totalMembers}\` total`,
                `**Channels:** \`${metrics.bot.channels.total}\` (\`${metrics.bot.channels.text}\` text, \`${metrics.bot.channels.voice}\` voice)`,
                `**Commands:** \`${metrics.bot.commands.total}\` (\`${metrics.bot.commands.modules}\` modules)`,
                `**WebSocket Ping:** \`${metrics.bot.connection.ping}ms\``,
                `**Process Uptime:** \`${metrics.bot.uptime}\``,
            ].join('\n');

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.ADMIN,
                title: '📈 System & Runtime Performance Dashboard',
                fields: [
                    { name: '💻 Host & Node.js System', value: systemValue, inline: false },
                    { name: '🤖 Bot & Discord Gateway', value: botValue, inline: false },
                ],
                footerText: 'EyeDaemon Live Diagnostics',
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.controller.log(`Error in performance command: ${error.message}`, 'error', {
                stack: error.stack,
            });
            await this.controller.safeReplyError(interaction, 'Failed to fetch performance metrics');
        }
    }
}

module.exports = PerformanceHandler;
