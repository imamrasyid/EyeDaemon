/**
 * PerformanceService
 *
 * Service for collecting and reporting performance metrics.
 * Provides system, bot, database, and cache metrics for monitoring.
 */

const BaseService = require('../../../../system/core/BaseService');
const { ChannelType } = require('discord.js');
const os = require('os');

const VALID_TABLE_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

class PerformanceService extends BaseService {
    /**
     * Create a new PerformanceService instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Service configuration options
     */
    constructor(client, options = {}) {
        super(client, options);
        this._previousCpuUsage = null;
        this._previousCpuTimestamp = null;
    }

    async initialize() {
        await super.initialize();
        this._previousCpuUsage = process.cpuUsage();
        this._previousCpuTimestamp = Date.now();
        this.log('PerformanceService initialized', 'info');
    }

    /**
     * Get system metrics (CPU, memory, OS info)
     * @returns {Object} System metrics
     */
    getSystemMetrics() {
        try {
            const memoryUsage = process.memoryUsage();
            const uptime = process.uptime();

            const currentCpu = process.cpuUsage();
            const now = Date.now();
            let cpuPercent = '0.00';

            if (this._previousCpuUsage && this._previousCpuTimestamp) {
                const userDelta = currentCpu.user - this._previousCpuUsage.user;
                const systemDelta = currentCpu.system - this._previousCpuUsage.system;
                const timeDeltaMs = now - this._previousCpuTimestamp;
                const timeDeltaUs = timeDeltaMs * 1000;

                if (timeDeltaUs > 0) {
                    cpuPercent = ((userDelta + systemDelta) / timeDeltaUs * 100).toFixed(2);
                }
            }

            this._previousCpuUsage = currentCpu;
            this._previousCpuTimestamp = now;

            return {
                memory: {
                    heapUsed: this.formatBytes(memoryUsage.heapUsed),
                    heapTotal: this.formatBytes(memoryUsage.heapTotal),
                    rss: this.formatBytes(memoryUsage.rss),
                    external: this.formatBytes(memoryUsage.external),
                    heapUsedRaw: memoryUsage.heapUsed,
                    heapTotalRaw: memoryUsage.heapTotal,
                    heapUsagePercent: ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(2),
                },
                cpu: {
                    usage: `${cpuPercent}%`,
                    user: currentCpu.user,
                    system: currentCpu.system,
                    cores: os.cpus().length,
                    model: os.cpus()[0]?.model || 'Unknown',
                },
                system: {
                    platform: os.platform(),
                    arch: os.arch(),
                    nodeVersion: process.version,
                    uptime: this.formatUptime(uptime),
                    uptimeSeconds: uptime,
                    totalMemory: this.formatBytes(os.totalmem()),
                    freeMemory: this.formatBytes(os.freemem()),
                    loadAverage: os.loadavg(),
                },
            };
        } catch (error) {
            this.handleError(error, 'getSystemMetrics');
            throw error;
        }
    }

    /**
     * Get bot metrics (guilds, users, channels, commands)
     * @returns {Object} Bot metrics
     */
    getBotMetrics() {
        try {
            const client = this.client;

            let totalMembers = 0;
            let totalTextChannels = 0;
            let totalVoiceChannels = 0;

            for (const guild of client.guilds.cache.values()) {
                totalMembers += guild.memberCount || 0;

                for (const channel of guild.channels.cache.values()) {
                    if (channel.type === ChannelType.GuildText) {
                        totalTextChannels++;
                    } else if (channel.type === ChannelType.GuildVoice) {
                        totalVoiceChannels++;
                    }
                }
            }

            const commandCount = client.commands ? client.commands.size : 0;
            const moduleCount = client.modules ? client.modules.size : 0;

            const shardInfo = client.shard ? {
                id: client.shard.ids[0],
                count: client.shard.count,
            } : null;

            return {
                guilds: {
                    total: client.guilds.cache.size,
                    available: client.guilds.cache.filter(g => g.available).size,
                    unavailable: client.guilds.cache.filter(g => !g.available).size,
                },
                users: {
                    cached: client.users.cache.size,
                    totalMembers: totalMembers,
                },
                channels: {
                    total: client.channels.cache.size,
                    text: totalTextChannels,
                    voice: totalVoiceChannels,
                },
                commands: {
                    total: commandCount,
                    modules: moduleCount,
                },
                connection: {
                    ping: client.ws.ping,
                    status: client.ws.status,
                    uptime: this.formatUptime(client.uptime / 1000),
                    uptimeMs: client.uptime,
                },
                shard: shardInfo,
            };
        } catch (error) {
            this.handleError(error, 'getBotMetrics');
            throw error;
        }
    }

    /**
     * Get database metrics (size, tables, row counts)
     * @returns {Promise<Object>} Database metrics
     */
    async getDatabaseMetrics() {
        try {
            const db = this.getDatabase();

            if (!db) {
                return {
                    available: false,
                    error: 'Database connection not available',
                };
            }

            let dbSize = 'N/A';
            let tableCount = 0;
            let totalRows = 0;
            let connectionType = 'Unknown';

            try {
                const dbUrl = this.client?.options?.db?.url
                    || this.client?.database?.config?.url
                    || '';

                if (dbUrl.startsWith('libsql://') || dbUrl.startsWith('https://')) {
                    connectionType = 'Turso (Remote)';
                } else if (dbUrl.startsWith('file:')) {
                    connectionType = 'SQLite (Local)';
                } else {
                    connectionType = 'SQLite';
                }

                const tables = await db.query(
                    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'"
                );
                tableCount = tables[0]?.count || 0;

                const tableNames = await db.query(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                );

                for (const table of tableNames) {
                    if (!VALID_TABLE_NAME.test(table.name)) {
                        this.log(`Skipping invalid table name: ${table.name}`, 'warn');
                        continue;
                    }

                    const rowCount = await db.query(`SELECT COUNT(*) as count FROM "${table.name}"`);
                    totalRows += rowCount[0]?.count || 0;
                }

                const pageCount = await db.query('PRAGMA page_count');
                const pageSize = await db.query('PRAGMA page_size');

                if (pageCount[0] && pageSize[0]) {
                    const sizeBytes = pageCount[0].page_count * pageSize[0].page_size;
                    dbSize = this.formatBytes(sizeBytes);
                }
            } catch (queryError) {
                this.log(`Error getting database stats: ${queryError.message}`, 'warn');
            }

            return {
                available: true,
                connection: {
                    type: connectionType,
                    status: 'Connected',
                },
                statistics: {
                    size: dbSize,
                    tables: tableCount,
                    totalRows: totalRows,
                },
                queries: db.stats || {
                    total: 'N/A',
                    successful: 'N/A',
                    failed: 'N/A',
                },
            };
        } catch (error) {
            this.handleError(error, 'getDatabaseMetrics');
            return {
                available: false,
                error: error.message,
            };
        }
    }

    /**
     * Get cache metrics from all services
     * @returns {Object} Cache metrics
     */
    getCacheMetrics() {
        try {
            const cacheMetrics = {
                services: {},
                total: {
                    hits: 0,
                    misses: 0,
                    size: 0,
                    hitRate: '0%',
                },
            };

            const guildConfigService = this.client.services.get('GuildConfigService');
            if (guildConfigService && typeof guildConfigService.getCacheStats === 'function') {
                const stats = guildConfigService.getCacheStats();
                cacheMetrics.services.GuildConfigService = stats;

                cacheMetrics.total.hits += stats.hits;
                cacheMetrics.total.misses += stats.misses;
                cacheMetrics.total.size += stats.size;
            }

            for (const [serviceName, service] of this.client.services.entries()) {
                if (serviceName === 'GuildConfigService') continue;

                if (service && typeof service.getCacheStats === 'function') {
                    try {
                        const stats = service.getCacheStats();
                        cacheMetrics.services[serviceName] = stats;

                        const hits = typeof stats.hits === 'number' ? stats.hits : 0;
                        const misses = typeof stats.misses === 'number' ? stats.misses : 0;
                        const size = typeof stats.size === 'number' ? stats.size : 0;

                        cacheMetrics.total.hits += hits;
                        cacheMetrics.total.misses += misses;
                        cacheMetrics.total.size += size;
                    } catch (serviceError) {
                        this.log(`Error getting cache stats from ${serviceName}: ${serviceError.message}`, 'warn');
                    }
                }
            }

            const totalRequests = cacheMetrics.total.hits + cacheMetrics.total.misses;
            if (totalRequests > 0) {
                const hitRate = (cacheMetrics.total.hits / totalRequests * 100).toFixed(2);
                cacheMetrics.total.hitRate = `${hitRate}%`;
            }

            return cacheMetrics;
        } catch (error) {
            this.handleError(error, 'getCacheMetrics');
            throw error;
        }
    }

    /**
     * Get all performance metrics
     * @returns {Promise<Object>} All metrics combined
     */
    async getAllMetrics() {
        try {
            const [databaseMetrics, cacheMetrics] = await Promise.all([
                this.getDatabaseMetrics(),
                Promise.resolve(this.getCacheMetrics()),
            ]);

            return {
                timestamp: new Date().toISOString(),
                system: this.getSystemMetrics(),
                bot: this.getBotMetrics(),
                database: databaseMetrics,
                cache: cacheMetrics,
            };
        } catch (error) {
            this.handleError(error, 'getAllMetrics');
            throw error;
        }
    }

    /**
     * Format bytes to human-readable string
     * @param {number} bytes - Bytes to format
     * @returns {string} Formatted string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    }

    /**
     * Format uptime to readable string
     * @param {number} seconds - Uptime in seconds
     * @returns {string} Formatted uptime
     */
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0) parts.push(`${secs}s`);

        return parts.join(' ') || '0s';
    }
}

module.exports = PerformanceService;
