/**
 * HealthHandler
 * 
 * Handles health check command
 */

const { EmbedBuilder } = require('discord.js');

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

            // Get health check service from client
            const healthCheckService = this.controller.client.healthCheckService;

            if (!healthCheckService) {
                return await interaction.editReply({
                    content: '❌ Health check service is not available.',
                });
            }

            // Perform health check
            const healthResult = await healthCheckService.checkHealth();

            // Determine embed color based on status
            let embedColor;
            let statusEmoji;
            switch (healthResult.status) {
                case 'healthy':
                    embedColor = 0x2ecc71; // Green
                    statusEmoji = '✅';
                    break;
                case 'degraded':
                    embedColor = 0xe67e22; // Orange
                    statusEmoji = '⚠️';
                    break;
                case 'unhealthy':
                    embedColor = 0xe74c3c; // Red
                    statusEmoji = '❌';
                    break;
                default:
                    embedColor = 0x95a5a6; // Gray
                    statusEmoji = '❓';
            }

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`${statusEmoji} Health Check Status`)
                .setDescription(`Overall Status: **${healthResult.status.toUpperCase()}**`)
                .addFields({
                    name: '⏱️ Response Time',
                    value: `${healthResult.responseTime}ms`,
                    inline: true,
                })
                .addFields({
                    name: '🔄 Consecutive Failures',
                    value: `${healthResult.consecutiveFailures}`,
                    inline: true,
                })
                .setTimestamp(healthResult.timestamp);

            // Add database check
            if (healthResult.checks.database) {
                const db = healthResult.checks.database;
                const dbStatus = db.status === 'healthy' ? '✅' : db.status === 'degraded' ? '⚠️' : '❌';
                const dbValue = [
                    `**Status:** ${dbStatus} ${db.status}`,
                    `**Connected:** ${db.isConnected ? 'Yes' : 'No'}`,
                    `**Response Time:** ${db.responseTime}ms`,
                    db.queryTime ? `**Query Time:** ${db.queryTime}ms` : '',
                ].filter(Boolean).join('\n');

                embed.addFields({
                    name: '🗄️ Database',
                    value: dbValue,
                    inline: false,
                });

                if (db.issues && db.issues.length > 0) {
                    embed.addFields({
                        name: '⚠️ Database Issues',
                        value: db.issues.join('\n'),
                        inline: false,
                    });
                }
            }

            // Add connection pool check
            if (healthResult.checks.connectionPool && healthResult.checks.connectionPool.status !== 'skipped') {
                const pool = healthResult.checks.connectionPool;
                const poolStatus = pool.status === 'healthy' ? '✅' : pool.status === 'degraded' ? '⚠️' : '❌';

                if (pool.stats) {
                    const poolValue = [
                        `**Status:** ${poolStatus} ${pool.status}`,
                        `**Pool Size:** ${pool.stats.poolSize} (${pool.stats.activeConnections} active, ${pool.stats.idleConnections} idle)`,
                        `**Queue Length:** ${pool.stats.queueLength}`,
                        `**Total Acquired:** ${pool.stats.totalAcquired}`,
                        `**Timeouts:** ${pool.stats.totalTimeouts}`,
                        `**Errors:** ${pool.stats.totalErrors}`,
                    ].join('\n');

                    embed.addFields({
                        name: '🔌 Connection Pool',
                        value: poolValue,
                        inline: false,
                    });
                }

                if (pool.issues && pool.issues.length > 0) {
                    embed.addFields({
                        name: '⚠️ Pool Issues',
                        value: pool.issues.join('\n'),
                        inline: false,
                    });
                }
            }

            // Add cache check
            if (healthResult.checks.cache && healthResult.checks.cache.status !== 'skipped') {
                const cache = healthResult.checks.cache;
                const cacheStatus = cache.status === 'healthy' ? '✅' : cache.status === 'degraded' ? '⚠️' : '❌';

                if (cache.stats) {
                    const cacheValue = [
                        `**Status:** ${cacheStatus} ${cache.status}`,
                        `**Hit Rate:** ${cache.stats.hitRate}`,
                        `**Total Requests:** ${cache.stats.totalRequests}`,
                        `**Active Entries:** ${cache.stats.activeEntries}`,
                        `**Expired Entries:** ${cache.stats.expiredEntries}`,
                    ].join('\n');

                    embed.addFields({
                        name: '⚡ Cache',
                        value: cacheValue,
                        inline: false,
                    });
                }

                if (cache.issues && cache.issues.length > 0) {
                    embed.addFields({
                        name: '⚠️ Cache Issues',
                        value: cache.issues.join('\n'),
                        inline: false,
                    });
                }
            }

            // Add migrations check
            if (healthResult.checks.migrations && healthResult.checks.migrations.status !== 'skipped') {
                const migrations = healthResult.checks.migrations;
                const migrationsStatus = migrations.status === 'healthy' ? '✅' : migrations.status === 'degraded' ? '⚠️' : '❌';

                if (migrations.migrationStatus) {
                    const migrationsValue = [
                        `**Status:** ${migrationsStatus} ${migrations.status}`,
                        `**Total Migrations:** ${migrations.migrationStatus.total}`,
                        `**Executed:** ${migrations.migrationStatus.executed}`,
                        `**Pending:** ${migrations.migrationStatus.pending}`,
                        `**Last Batch:** ${migrations.migrationStatus.lastBatch}`,
                    ].join('\n');

                    embed.addFields({
                        name: '📦 Migrations',
                        value: migrationsValue,
                        inline: false,
                    });
                }

                if (migrations.issues && migrations.issues.length > 0) {
                    embed.addFields({
                        name: '⚠️ Migration Issues',
                        value: migrations.issues.join('\n'),
                        inline: false,
                    });
                }
            }

            // Add overall issues if any
            if (healthResult.issues && healthResult.issues.length > 0) {
                embed.addFields({
                    name: '⚠️ Overall Issues',
                    value: healthResult.issues.join('\n'),
                    inline: false,
                });
            }

            // Get health check statistics
            const stats = healthCheckService.getStats();
            if (stats) {
                const statsValue = [
                    `**Total Checks:** ${stats.totalChecks}`,
                    `**Successful:** ${stats.successfulChecks}`,
                    `**Degraded:** ${stats.degradedChecks}`,
                    `**Failed:** ${stats.failedChecks}`,
                    `**Avg Response Time:** ${stats.averageResponseTime}ms`,
                ].join('\n');

                embed.addFields({
                    name: '📊 Statistics',
                    value: statsValue,
                    inline: false,
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            this.controller.log(`Error in health command: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to perform health check');
        }
    }
}

module.exports = HealthHandler;
