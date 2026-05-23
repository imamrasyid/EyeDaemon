/**
 * PerformanceHandler
 * 
 * Handles performance metrics command
 */

const { EmbedBuilder } = require('discord.js');

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
                return await interaction.editReply({
                    content: '❌ PerformanceService is not available.',
                });
            }

            // Get all metrics from PerformanceService
            const metrics = await this.controller.performanceService.getAllMetrics();

            // Create embed with comprehensive metrics
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('📊 Performance Metrics')
                .setDescription('Comprehensive bot performance and system metrics')
                .setTimestamp();

            // System metrics
            const systemValue = [
                `**Memory:** ${metrics.system.memory.heapUsed} / ${metrics.system.memory.heapTotal} (${metrics.system.memory.heapUsagePercent}%)`,
                `**CPU Usage:** ${metrics.system.cpu.usage}`,
                `**CPU Cores:** ${metrics.system.cpu.cores}`,
                `**Uptime:** ${metrics.system.system.uptime}`,
                `**Platform:** ${metrics.system.system.platform} (${metrics.system.system.arch})`,
            ].join('\n');

            embed.addFields({
                name: '💻 System',
                value: systemValue,
                inline: false,
            });

            // Bot metrics
            const botValue = [
                `**Guilds:** ${metrics.bot.guilds.total} (${metrics.bot.guilds.available} available)`,
                `**Users:** ${metrics.bot.users.cached} cached / ${metrics.bot.users.totalMembers} total`,
                `**Channels:** ${metrics.bot.channels.total} (${metrics.bot.channels.text} text, ${metrics.bot.channels.voice} voice)`,
                `**Commands:** ${metrics.bot.commands.total} (${metrics.bot.commands.modules} modules)`,
                `**Ping:** ${metrics.bot.connection.ping}ms`,
                `**Bot Uptime:** ${metrics.bot.connection.uptime}`,
            ].join('\n');

            embed.addFields({
                name: '🤖 Bot',
                value: botValue,
                inline: false,
            });

            // Database metrics
            if (metrics.database.available) {
                const dbValue = [
                    `**Status:** ${metrics.database.connection.status}`,
                    `**Type:** ${metrics.database.connection.type}`,
                    `**Size:** ${metrics.database.statistics.size}`,
                    `**Tables:** ${metrics.database.statistics.tables}`,
                    `**Total Rows:** ${metrics.database.statistics.totalRows}`,
                ].join('\n');

                embed.addFields({
                    name: '🗄️ Database',
                    value: dbValue,
                    inline: false,
                });
            } else {
                embed.addFields({
                    name: '🗄️ Database',
                    value: `❌ ${metrics.database.error}`,
                    inline: false,
                });
            }

            // Cache metrics
            const cacheValue = [
                `**Total Hits:** ${metrics.cache.total.hits}`,
                `**Total Misses:** ${metrics.cache.total.misses}`,
                `**Hit Rate:** ${metrics.cache.total.hitRate}`,
                `**Cache Size:** ${metrics.cache.total.size} entries`,
            ].join('\n');

            embed.addFields({
                name: '⚡ Cache',
                value: cacheValue,
                inline: false,
            });

            // Add service-specific cache stats if available
            if (Object.keys(metrics.cache.services).length > 0) {
                const serviceStats = Object.entries(metrics.cache.services)
                    .map(([name, stats]) => `**${name}:** ${stats.hits} hits, ${stats.misses} misses (${stats.hitRate})`)
                    .join('\n');

                embed.addFields({
                    name: '📦 Service Caches',
                    value: serviceStats,
                    inline: false,
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            this.controller.log(`Error in performance command: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to fetch performance metrics');
        }
    }
}

module.exports = PerformanceHandler;
