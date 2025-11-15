/**
 * PerformanceService
 * 
 * Service for collecting and reporting performance metrics.
 * Provides system, bot, database, and cache metrics for monitoring.
 */

const BaseService = require('../../../../system/core/BaseService');
const os = require('os');

class PerformanceService extends BaseService {
    /**
     * Create a new PerformanceService instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Service configuration options
     */
    constructor(client, options = {}) {
        super(client, options);
    }

    /**
     * Initialize service
     * @returns {Promise<void>}
     */
    async initialize() {
        await super.initialize();
        this.log('PerformanceService initialized', 'info');
    }

    /**
     * Get system metrics (CPU, memory, OS info)
     * @returns {Object} System metrics
     */
    getSystemMetrics() {
        try {
            const memoryUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            const uptime = process.uptime();

            // Calculate CPU usage percentage
            const totalCPU = cpuUsage.user + cpuUsage.system;
            const cpuPercent = (totalCPU / (uptime * 1000000) * 100).toFixed(2);

            return {
                // Memory metrics
                memory: {
                    heapUsed: this.formatBytes(memoryUsage.heapUsed),
                    heapTotal: this.formatBytes(memoryUsage.heapTotal),
                    rss: this.formatBytes(memoryUsage.rss),
                    external: this.formatBytes(memoryUsage.external),
                    heapUsedRaw: memoryUsage.heapUsed,
                    heapTotalRaw: memoryUsage.heapTotal,
                    heapUsagePercent: ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(2),
                },
                // CPU metrics
                cpu: {
                    usage: `${cpuPercent}%`,
                    user: cpuUsage.user,
                    system: cpuUsage.system,
                    cores: os.cpus().length,
                    model: os.cpus()[0]?.model || 'Unknown',
                },
                // System info
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

            // Calculate total members across all guilds
            let totalMembers = 0;
            let totalTextChannels = 0;
            let totalVoiceChannels = 0;

            for (const guild of client.guilds.cache.values()) {
                totalMembers += guild.memberCount || 0;

                for (const channel of guild.channels.cache.values()) {
                    if (channel.type === 0) { // GUILD_TEXT
                        totalTextChannels++;
                    } else if (channel.type === 2) { // GUILD_VOICE
                        totalVoiceChannels++;
                    }
                }
            }

            // Get command count
            const commandCount = client.commands ? client.commands.size : 0;

            // Get module count
            const moduleCount = client.modules ? client.modules.size : 0;

            // Get shard info if sharded
            const shardInfo = client.shard ? {
                id: client.shard.ids[0],
                count: client.shard.count,
            } : null;

            return {
                // Guild metrics
                guilds: {
                    total: client.guilds.cache.size,
                    available: client.guilds.cache.filter(g => g.available).size,
                    unavailable: client.guilds.cache.filter(g => !g.available).size,
                },
                // User metrics
                users: {
                    cached: client.users.cache.size,
                    totalMembers: totalMembers,
                },
                // Channel metrics
                channels: {
                    total: client.channels.cache.size,
                    text: totalTextChannels,
                    voice: totalVoiceChannels,
                },
                // Command metrics
                commands: {
                    total: commandCount,
                    modules: moduleCount,
                },
                // Connection metrics
                connection: {
                    ping: client.ws.ping,
                    status: client.ws.status,
                    uptime: this.formatUptime(client.uptime / 1000),
                    uptimeMs: client.uptime,
                },
                // Shard info (if applicable)
                shard: shardInfo,
            };
        } catch (error) {
            this.handleError(error, 'getBotMetrics');
            throw error;
        }
    }

    /**
     * Get database metrics (query stats, connection info)
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

            // Get database file size (if SQLite)
            let dbSize = 'N/A';
            let tableCount = 0;
            let totalRows = 0;

            try {
                // Get table count
                const tables = await db.query(
                    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'"
                );
                tableCount = tables[0]?.count || 0;

                // Get total row count across all tables
                const tableNames = await db.query(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                );

                for (const table of tableNames) {
                    const rowCount = await db.query(`SELECT COUNT(*) as count FROM ${table.name}`);
                    totalRows += rowCount[0]?.count || 0;
                }

                // Get database page count and page size to calculate size
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
                    type: 'SQLite',
                    status: 'Connected',
                },
                statistics: {
                    size: dbSize,
                    tables: tableCount,
                    totalRows: totalRows,
                },
                // Query statistics (if available from db object)
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

            // Get GuildConfigService cache stats
            const guildConfigService = this.client.services.get('GuildConfigService');
            if (guildConfigService && typeof guildConfigService.getCacheStats === 'function') {
                const stats = guildConfigService.getCacheStats();
                cacheMetrics.services.GuildConfigService = stats;

                cacheMetrics.total.hits += stats.hits;
                cacheMetrics.total.misses += stats.misses;
                cacheMetrics.total.size += stats.size;
            }

            // Get cache stats from other services if they implement getCacheStats
            for (const [serviceName, service] of this.client.services.entries()) {
                if (serviceName === 'GuildConfigService') continue; // Already added

                if (service && typeof service.getCacheStats === 'function') {
                    try {
                        const stats = service.getCacheStats();
                        cacheMetrics.services[serviceName] = stats;

                        // Parse hits and misses if they're numbers
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

            // Calculate total hit rate
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
            const [systemMetrics, botMetrics, databaseMetrics, cacheMetrics] = await Promise.all([
                Promise.resolve(this.getSystemMetrics()),
                Promise.resolve(this.getBotMetrics()),
                this.getDatabaseMetrics(),
                Promise.resolve(this.getCacheMetrics()),
            ]);

            return {
                timestamp: new Date().toISOString(),
                system: systemMetrics,
                bot: botMetrics,
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
