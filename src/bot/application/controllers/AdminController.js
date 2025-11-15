/**
 * AdminController
 * 
 * Handles all admin-related commands
 * Manages guild configuration and performance monitoring
 */

const Controller = require('../../system/core/Controller');
const { EmbedBuilder } = require('discord.js');
const { replyEphemeral } = require('../../system/helpers/interaction_helper');

class AdminController extends Controller {
    /**
     * Create a new AdminController instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client);

        // Load models
        this.guildModel = this.load.model('GuildModel');

        // Get services
        this.guildConfigService = this.client.services.get('GuildConfigService');
        this.performanceService = this.client.services.get('PerformanceService');
    }

    /**
     * Config command handler
     * Manages guild configuration settings
     * @param {Object} interaction - Discord interaction
     */
    async config(interaction) {
        try {
            // Check if user has Administrator permission
            if (!interaction.member.permissions.has('Administrator')) {
                return await replyEphemeral(interaction, '❌ You need Administrator permission to use this command.');
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
                    await replyEphemeral(interaction, '❌ Unknown subcommand');
            }
        } catch (error) {
            this.log(`Error in config command: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.safeReplyError(interaction, 'Failed to manage configuration');
        }
    }

    /**
     * View guild configuration (config view subcommand)
     * @param {Object} interaction - Discord interaction
     */
    async configView(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;

            if (!this.guildConfigService) {
                return await interaction.editReply({
                    content: '❌ GuildConfigService is not available.',
                });
            }

            // Fetch all settings for the guild
            const config = await this.guildConfigService.getGuildConfig(guildId);

            // Create embed with organized categories
            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('⚙️ Guild Configuration')
                .setDescription(`Current configuration for **${interaction.guild.name}**\n\nUse \`/config set\` to change settings or \`/config list\` to see all available settings.`)
                .setTimestamp();

            // General settings
            embed.addFields({
                name: '📋 General',
                value: `**Prefix:** \`${config.prefix}\``,
                inline: false,
            });

            // Music settings
            const musicValue = [
                `**DJ Role:** ${config.dj_role ? `<@&${config.dj_role}>` : 'Not set'}`,
                `**Default Volume:** ${config.volume_default}%`,
                `**Max Queue Size:** ${config.max_queue_size} tracks`,
            ].join('\n');

            embed.addFields({
                name: '🎵 Music',
                value: musicValue,
                inline: false,
            });

            // Welcome & Goodbye settings
            const welcomeGoodbyeValue = [
                `**Welcome Enabled:** ${config.welcome_enabled ? '✅ Yes' : '❌ No'}`,
                `**Welcome Channel:** ${config.welcome_channel ? `<#${config.welcome_channel}>` : 'Not set'}`,
                `**Welcome Message:** ${config.welcome_message ? `\`${config.welcome_message.substring(0, 40)}${config.welcome_message.length > 40 ? '...' : ''}\`` : 'Not set'}`,
                `**Auto Role:** ${config.auto_role ? `<@&${config.auto_role}>` : 'Not set'}`,
                ``,
                `**Goodbye Enabled:** ${config.goodbye_enabled ? '✅ Yes' : '❌ No'}`,
                `**Goodbye Channel:** ${config.goodbye_channel ? `<#${config.goodbye_channel}>` : 'Not set'}`,
                `**Goodbye Message:** ${config.goodbye_message ? `\`${config.goodbye_message.substring(0, 40)}${config.goodbye_message.length > 40 ? '...' : ''}\`` : 'Not set'}`,
            ].join('\n');

            embed.addFields({
                name: '👋 Welcome & Goodbye System',
                value: welcomeGoodbyeValue,
                inline: false,
            });

            // Moderation settings
            const moderationValue = [
                `**Log Channel:** ${config.moderation_log_channel ? `<#${config.moderation_log_channel}>` : 'Not set'}`,
            ].join('\n');

            embed.addFields({
                name: '🛡️ Moderation',
                value: moderationValue,
                inline: false,
            });

            // Leveling settings
            const levelingValue = [
                `**XP Multiplier:** ${config.leveling_xp_multiplier}x`,
            ].join('\n');

            embed.addFields({
                name: '📈 Leveling',
                value: levelingValue,
                inline: false,
            });

            // Economy settings
            const economyValue = [
                `**Starting Balance:** ${config.economy_starting_balance} coins`,
            ].join('\n');

            embed.addFields({
                name: '💰 Economy',
                value: economyValue,
                inline: false,
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            this.log(`Error in configView: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.safeReplyError(interaction, 'Failed to fetch configuration');
        }
    }

    /**
     * Set guild configuration (config set subcommand)
     * @param {Object} interaction - Discord interaction
     */
    async configSet(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const setting = interaction.options.getString('setting');
            const value = interaction.options.getString('value');

            if (!this.guildConfigService) {
                return await interaction.editReply({
                    content: '❌ GuildConfigService is not available.',
                });
            }

            // Validate setting exists
            const availableSettings = this.guildConfigService.listAvailableSettings();
            const allSettings = Object.values(availableSettings).flat();
            const settingExists = allSettings.some(s => s.key === setting);

            if (!settingExists) {
                return await interaction.editReply({
                    content: `❌ Unknown setting: \`${setting}\`\n\nUse \`/config list\` to see all available settings.`,
                });
            }

            // Set the setting
            await this.guildConfigService.setSetting(guildId, setting, value);

            // Get the new value to display
            const newValue = await this.guildConfigService.getSetting(guildId, setting);

            // Format the value for display
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

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ Configuration Updated')
                .setDescription(`Successfully updated **${setting}**`)
                .addFields({
                    name: 'New Value',
                    value: displayValue,
                    inline: false,
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            this.log(`Error in configSet: ${error.message}`, 'error', {
                stack: error.stack,
                setting: interaction.options.getString('setting'),
                value: interaction.options.getString('value')
            });

            // Check if we can still reply
            try {
                if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({
                        content: `❌ Failed to set configuration: ${error.message}`,
                    });
                } else if (!interaction.replied) {
                    await interaction.reply({
                        content: `❌ Failed to set configuration: ${error.message}`,
                        flags: 64 // MessageFlags.Ephemeral
                    });
                }
            } catch (replyError) {
                this.log(`Failed to send error message: ${replyError.message}`, 'error');
            }
        }
    }

    /**
     * Reset guild configuration (config reset subcommand)
     * @param {Object} interaction - Discord interaction
     */
    async configReset(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const setting = interaction.options.getString('setting');

            if (!this.guildConfigService) {
                return await interaction.editReply({
                    content: '❌ GuildConfigService is not available.',
                });
            }

            // Validate setting exists
            const availableSettings = this.guildConfigService.listAvailableSettings();
            const allSettings = Object.values(availableSettings).flat();
            const settingMetadata = allSettings.find(s => s.key === setting);

            if (!settingMetadata) {
                return await interaction.editReply({
                    content: `❌ Unknown setting: \`${setting}\`\n\nUse \`/config list\` to see all available settings.`,
                });
            }

            // Reset the setting
            try {
                await this.guildConfigService.resetSetting(guildId, setting);

                // Format the default value for display
                let displayValue = settingMetadata.default;
                if (setting.includes('role') && displayValue) {
                    displayValue = `<@&${displayValue}>`;
                } else if (setting.includes('channel') && displayValue) {
                    displayValue = `<#${displayValue}>`;
                } else if (typeof displayValue === 'boolean') {
                    displayValue = displayValue ? '✅ Enabled' : '❌ Disabled';
                } else if (displayValue === null) {
                    displayValue = 'Not set';
                } else {
                    displayValue = `\`${displayValue}\``;
                }

                const embed = new EmbedBuilder()
                    .setColor(0xe67e22)
                    .setTitle('🔄 Configuration Reset')
                    .setDescription(`Successfully reset **${setting}** to default value`)
                    .addFields({
                        name: 'Default Value',
                        value: displayValue,
                        inline: false,
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                this.log(`Error resetting config: ${error.message}`, 'error');
                return await interaction.editReply({
                    content: `❌ Failed to reset configuration: ${error.message}`,
                });
            }
        } catch (error) {
            this.log(`Error in configReset: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.safeReplyError(interaction, 'Failed to reset configuration');
        }
    }

    /**
     * List all available settings (config list subcommand)
     * @param {Object} interaction - Discord interaction
     */
    async configList(interaction) {
        try {
            await interaction.deferReply();

            if (!this.guildConfigService) {
                return await interaction.editReply({
                    content: '❌ GuildConfigService is not available.',
                });
            }

            // Get all available settings grouped by category
            const settingsByCategory = this.guildConfigService.listAvailableSettings();

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle('📋 Available Settings')
                .setDescription('Use `/config set <setting> <value>` to change a setting\nUse `/config reset <setting>` to reset to default')
                .setTimestamp();

            // Category display names
            const categoryNames = {
                general: '📋 General',
                music: '🎵 Music',
                welcome: '👋 Welcome System',
                moderation: '🛡️ Moderation',
                leveling: '📈 Leveling',
                economy: '💰 Economy',
            };

            // Add fields for each category with character limit check
            for (const [category, settings] of Object.entries(settingsByCategory)) {
                const categoryName = categoryNames[category] || category;

                // Create shorter format to avoid embed limits
                const settingsText = settings.map(setting => {
                    let defaultValue = setting.default;
                    if (defaultValue === null) {
                        defaultValue = 'Not set';
                    } else if (typeof defaultValue === 'boolean') {
                        defaultValue = defaultValue ? '✅' : '❌';
                    } else if (String(defaultValue).length > 20) {
                        defaultValue = String(defaultValue).substring(0, 17) + '...';
                    }

                    // Shorter format
                    return `\`${setting.key}\` - ${setting.description.substring(0, 50)}${setting.description.length > 50 ? '...' : ''}`;
                }).join('\n');

                // Check if adding this field would exceed limits
                if (settingsText.length > 1024) {
                    // Split into multiple fields if too long
                    const chunks = [];
                    const lines = settingsText.split('\n');
                    let currentChunk = '';

                    for (const line of lines) {
                        if ((currentChunk + line + '\n').length > 1024) {
                            chunks.push(currentChunk);
                            currentChunk = line + '\n';
                        } else {
                            currentChunk += line + '\n';
                        }
                    }
                    if (currentChunk) chunks.push(currentChunk);

                    // Add chunks as separate fields
                    chunks.forEach((chunk, index) => {
                        embed.addFields({
                            name: index === 0 ? categoryName : `${categoryName} (cont.)`,
                            value: chunk,
                            inline: false,
                        });
                    });
                } else {
                    embed.addFields({
                        name: categoryName,
                        value: settingsText || 'No settings',
                        inline: false,
                    });
                }
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            this.log(`Error in configList: ${error.message}`, 'error', {
                stack: error.stack,
                errorName: error.name
            });
            await this.safeReplyError(interaction, `Failed to list settings: ${error.message}`);
        }
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
            const healthCheckService = this.client.healthCheckService;

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
            this.log(`Error in health command: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.safeReplyError(interaction, 'Failed to perform health check');
        }
    }

    /**
     * Performance command handler
     * Displays bot performance metrics
     * @param {Object} interaction - Discord interaction
     */
    async performance(interaction) {
        try {
            await interaction.deferReply();

            if (!this.performanceService) {
                return await interaction.editReply({
                    content: '❌ PerformanceService is not available.',
                });
            }

            // Get all metrics from PerformanceService
            const metrics = await this.performanceService.getAllMetrics();

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
            this.log(`Error in performance command: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.safeReplyError(interaction, 'Failed to fetch performance metrics');
        }
    }

    /**
     * Safely reply with error message
     * Handles cases where interaction is already replied or expired
     * @param {Object} interaction - Discord interaction
     * @param {string} message - Error message
     */
    async safeReplyError(interaction, message) {
        try {
            const errorMessage = `❌ ${message}`;

            if (interaction.deferred && !interaction.replied) {
                // Interaction was deferred but not replied yet
                await interaction.editReply({ content: errorMessage });
            } else if (!interaction.replied && !interaction.deferred) {
                // Interaction not deferred and not replied
                await interaction.reply({
                    content: errorMessage,
                    flags: 64 // MessageFlags.Ephemeral
                });
            }
            // If already replied, we can't do anything
        } catch (error) {
            this.log(`Failed to send error message: ${error.message}`, 'error');
        }
    }

}

module.exports = AdminController;
