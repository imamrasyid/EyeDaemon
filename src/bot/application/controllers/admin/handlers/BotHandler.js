'use strict';

/**
 * BotHandler
 *
 * Handles bot management commands: status, diagnostics.
 * Provides server admins with bot runtime information.
 */

const ResponseHelper = require('../../../../system/helpers/ResponseHelper');
const os = require('os');

class BotHandler {
    constructor(controller) {
        this.controller = controller;
    }

    /**
     * Bot command router
     */
    async bot(interaction) {
        try {
            if (!interaction.member.permissions.has('Administrator')) {
                return await this.controller.sendError(interaction, 'You need **Administrator** permission to use this command.', true);
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'status':
                    await this.botStatus(interaction);
                    break;
                case 'diagnostics':
                    await this.botDiagnostics(interaction);
                    break;
                default:
                    await this.controller.sendError(interaction, 'Unknown subcommand', true);
            }
        } catch (error) {
            this.controller.log(`Error in bot command: ${error.message}`, 'error', {
                stack: error.stack
            });
            if (!interaction.deferred && !interaction.replied) {
                await this.controller.safeReplyError(interaction, 'Failed to execute bot command');
            }
        }
    }

    /**
     * Show bot status overview
     */
    async botStatus(interaction) {
        try {
            await interaction.deferReply();

            const client = this.controller.client;
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const uptimeStr = `${days}d ${hours}h ${minutes}m`;

            const memoryUsage = process.memoryUsage();
            const heapUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
            const heapTotal = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
            const rss = (memoryUsage.rss / 1024 / 1024).toFixed(2);

            const statusValue = [
                `**Bot Tag:** \`${client.user.tag}\``,
                `**Guilds:** \`${client.guilds.cache.size}\``,
                `**Users:** \`${client.users.cache.size}\` cached`,
                `**Uptime:** \`${uptimeStr}\``,
                `**WebSocket Ping:** \`${client.ws.ping}ms\``,
            ].join('\n');

            const systemValue = [
                `**Platform:** \`${os.platform()} (${os.arch()})\``,
                `**Node.js:** \`${process.version}\``,
                `**Memory:** \`${heapUsed}MB / ${heapTotal}MB\` heap, \`${rss}MB\` RSS`,
                `**CPU:** \`${os.cpus()[0]?.model || 'Unknown'}\``,
                `**CPUs:** \`${os.cpus().length}\` cores`,
            ].join('\n');

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.SUCCESS,
                title: '🤖 Bot Status',
                fields: [
                    { name: 'Discord', value: statusValue, inline: false },
                    { name: 'System', value: systemValue, inline: false },
                ],
                footerText: 'EyeDaemon Status Report',
                timestamp: new Date().toISOString(),
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.controller.log(`Error in botStatus: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to get bot status');
        }
    }

    /**
     * Show detailed diagnostics
     */
    async botDiagnostics(interaction) {
        try {
            await interaction.deferReply();

            const client = this.controller.client;

            const moduleList = [];
            if (client.modules) {
                for (const [name, mod] of client.modules) {
                    const cmdCount = mod.commands ? mod.commands.length : 0;
                    moduleList.push(`• \`${name}\` — ${cmdCount} commands`);
                }
            }

            const serviceList = [];
            if (client.services) {
                for (const [name] of client.services) {
                    serviceList.push(`• \`${name}\``);
                }
            }

            const modulesValue = moduleList.length > 0 ? moduleList.join('\n') : 'No modules loaded';
            const servicesValue = serviceList.length > 0 ? serviceList.join('\n') : 'No services loaded';

            const cacheStats = this.controller.guildConfigService
                ? this.controller.guildConfigService.getCacheStats()
                : null;
            const cacheValue = cacheStats
                ? `**Hits:** \`${cacheStats.hits}\` / **Misses:** \`${cacheStats.misses}\` (\`${cacheStats.hitRate}\`)\n**Entries:** \`${cacheStats.size}\``
                : 'Cache statistics unavailable';

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.ADMIN,
                title: '🔍 Bot Diagnostics',
                fields: [
                    { name: `📦 Modules (${moduleList.length})`, value: modulesValue, inline: false },
                    { name: `⚙️ Services (${serviceList.length})`, value: servicesValue, inline: false },
                    { name: '🗄️ Config Cache', value: cacheValue, inline: false },
                ],
                footerText: 'EyeDaemon Diagnostics',
                timestamp: new Date().toISOString(),
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.controller.log(`Error in botDiagnostics: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to get diagnostics');
        }
    }
}

module.exports = BotHandler;
