/**
 * Health Check Service
 * 
 * Provides comprehensive health checks for the bot's database infrastructure.
 * Monitors database connection, connection pool, cache, and migration status.
 * 
 * Features:
 * - Database connection health check with response time
 * - Connection pool health check with statistics
 * - Cache health check with hit rate monitoring
 * - Migration status verification
 * - Periodic health checks with configurable intervals
 * - Alert on health check failures
 * 
 * Usage:
 * ```javascript
 * const healthCheckService = new HealthCheckService({
 *   database: databaseInstance,
 *   connectionPool: poolInstance,
 *   cacheManager: cacheInstance,
 *   migrationManager: migrationInstance,
 *   logger: console
 * });
 * 
 * // Perform a full health check
 * const health = await healthCheckService.checkHealth();
 * console.log(health);
 * 
 * // Start periodic health checks
 * healthCheckService.startPeriodicChecks(300000); // Every 5 minutes
 * 
 * // Stop periodic health checks
 * healthCheckService.stopPeriodicChecks();
 * ```
 */

const { DatabaseError } = require('../core/Errors');

class HealthCheckService {
    /**
     * Create a new HealthCheckService instance
     * @param {Object} config - Health check configuration
     * @param {Object} config.database - Database library instance
     * @param {Object} config.connectionPool - Connection pool instance (optional)
     * @param {Object} config.cacheManager - Cache manager instance (optional)
     * @param {Object} config.migrationManager - Migration manager instance (optional)
     * @param {Object} config.logger - Logger instance
     * @param {number} config.checkInterval - Periodic check interval in ms (default: 300000 - 5 minutes)
     * @param {Function} config.onFailure - Callback function for health check failures
     */
    constructor(config = {}) {
        if (!config.database) {
            throw new DatabaseError('Database instance is required for HealthCheckService', {
                config: 'missing database'
            });
        }

        this.database = config.database;
        this.connectionPool = config.connectionPool || null;
        this.cacheManager = config.cacheManager || null;
        this.migrationManager = config.migrationManager || null;
        this.logger = config.logger || console;

        // Configuration
        this.config = {
            checkInterval: config.checkInterval || 300000, // 5 minutes default
            onFailure: config.onFailure || null,
            enablePeriodicChecks: config.enablePeriodicChecks !== false,
            ...config
        };

        // State
        this.periodicCheckTimer = null;
        this.lastCheckResult = null;
        this.lastCheckTime = null;
        this.consecutiveFailures = 0;

        // Statistics
        this.stats = {
            totalChecks: 0,
            successfulChecks: 0,
            failedChecks: 0,
            degradedChecks: 0,
            averageResponseTime: 0,
            responseTimes: []
        };
    }

    /**
     * Perform a comprehensive health check
     * @returns {Promise<Object>} Health check result
     */
    async checkHealth() {
        const startTime = Date.now();
        const checks = {};
        let overallStatus = 'healthy';
        const issues = [];

        try {
            // Check database connection
            checks.database = await this.checkDatabaseConnection();
            if (checks.database.status !== 'healthy') {
                overallStatus = checks.database.status === 'unhealthy' ? 'unhealthy' : 'degraded';
                issues.push(...(checks.database.issues || []));
            }

            // Check connection pool if available
            if (this.connectionPool) {
                checks.connectionPool = await this.checkConnectionPool();
                if (checks.connectionPool.status !== 'healthy') {
                    if (checks.connectionPool.status === 'unhealthy') {
                        overallStatus = 'unhealthy';
                    } else if (overallStatus === 'healthy') {
                        overallStatus = 'degraded';
                    }
                    issues.push(...(checks.connectionPool.issues || []));
                }
            }

            // Check cache if available
            if (this.cacheManager) {
                checks.cache = await this.checkCache();
                if (checks.cache.status !== 'healthy') {
                    if (checks.cache.status === 'unhealthy') {
                        overallStatus = 'unhealthy';
                    } else if (overallStatus === 'healthy') {
                        overallStatus = 'degraded';
                    }
                    issues.push(...(checks.cache.issues || []));
                }
            }

            // Check migrations if available
            if (this.migrationManager) {
                checks.migrations = await this.checkMigrations();
                if (checks.migrations.status !== 'healthy') {
                    if (checks.migrations.status === 'unhealthy') {
                        overallStatus = 'unhealthy';
                    } else if (overallStatus === 'healthy') {
                        overallStatus = 'degraded';
                    }
                    issues.push(...(checks.migrations.issues || []));
                }
            }

            const responseTime = Date.now() - startTime;

            // Update statistics
            this.stats.totalChecks++;
            if (overallStatus === 'healthy') {
                this.stats.successfulChecks++;
                this.consecutiveFailures = 0;
            } else if (overallStatus === 'degraded') {
                this.stats.degradedChecks++;
                this.consecutiveFailures = 0;
            } else {
                this.stats.failedChecks++;
                this.consecutiveFailures++;
            }

            // Track response times (keep last 100)
            this.stats.responseTimes.push(responseTime);
            if (this.stats.responseTimes.length > 100) {
                this.stats.responseTimes.shift();
            }

            // Calculate average response time
            this.stats.averageResponseTime = Math.round(
                this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length
            );

            const result = {
                status: overallStatus,
                timestamp: Date.now(),
                responseTime,
                checks,
                issues,
                consecutiveFailures: this.consecutiveFailures
            };

            this.lastCheckResult = result;
            this.lastCheckTime = Date.now();

            // Log health check result
            this.log(`Health check completed: ${overallStatus}`, overallStatus === 'healthy' ? 'info' : 'warn', {
                status: overallStatus,
                responseTime,
                issueCount: issues.length
            });

            // Call failure callback if configured
            if (overallStatus === 'unhealthy' && this.config.onFailure) {
                try {
                    await this.config.onFailure(result);
                } catch (error) {
                    this.log(`Error in failure callback: ${error.message}`, 'error');
                }
            }

            return result;
        } catch (error) {
            this.stats.totalChecks++;
            this.stats.failedChecks++;
            this.consecutiveFailures++;

            this.log(`Health check error: ${error.message}`, 'error');

            const errorResult = {
                status: 'unhealthy',
                timestamp: Date.now(),
                responseTime: Date.now() - startTime,
                checks,
                issues: [`Health check failed: ${error.message}`],
                error: error.message,
                consecutiveFailures: this.consecutiveFailures
            };

            this.lastCheckResult = errorResult;
            this.lastCheckTime = Date.now();

            return errorResult;
        }
    }

    /**
     * Check database connection health
     * @returns {Promise<Object>} Database health check result
     */
    async checkDatabaseConnection() {
        const startTime = Date.now();
        const issues = [];
        let status = 'healthy';

        try {
            // Check if database is ready
            if (!this.database.isReady()) {
                issues.push('Database connection not ready');
                status = 'unhealthy';
            }

            // Test database connection with a simple query
            const queryStart = Date.now();
            await this.database.query('SELECT 1 as test');
            const queryTime = Date.now() - queryStart;

            // Check query response time
            if (queryTime > 1000) {
                issues.push(`Slow database response: ${queryTime}ms`);
                status = status === 'healthy' ? 'degraded' : status;
            }

            const responseTime = Date.now() - startTime;

            return {
                status,
                responseTime,
                queryTime,
                isConnected: this.database.isReady(),
                issues,
                timestamp: Date.now()
            };
        } catch (error) {
            issues.push(`Database connection test failed: ${error.message}`);

            return {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                isConnected: false,
                error: error.message,
                issues,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Check connection pool health
     * @returns {Promise<Object>} Connection pool health check result
     */
    async checkConnectionPool() {
        const issues = [];
        let status = 'healthy';

        try {
            if (!this.connectionPool) {
                return {
                    status: 'skipped',
                    message: 'Connection pool not configured',
                    timestamp: Date.now()
                };
            }

            // Get pool health check
            const poolHealth = await this.connectionPool.healthCheck();

            // Use pool's own health status
            status = poolHealth.status;

            // Add pool-specific issues
            if (poolHealth.issues && poolHealth.issues.length > 0) {
                issues.push(...poolHealth.issues);
            }

            return {
                status,
                stats: poolHealth.stats,
                connectionTest: poolHealth.connectionTest,
                issues,
                timestamp: Date.now()
            };
        } catch (error) {
            issues.push(`Connection pool check failed: ${error.message}`);

            return {
                status: 'unhealthy',
                error: error.message,
                issues,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Check cache health
     * @returns {Promise<Object>} Cache health check result
     */
    async checkCache() {
        const issues = [];
        let status = 'healthy';

        try {
            if (!this.cacheManager) {
                return {
                    status: 'skipped',
                    message: 'Cache manager not configured',
                    timestamp: Date.now()
                };
            }

            // Get cache statistics
            const cacheStats = await this.cacheManager.getStats();

            // Check cache hit rate
            const hitRate = parseFloat(cacheStats.hitRate);
            if (hitRate < 50 && cacheStats.totalRequests > 100) {
                issues.push(`Low cache hit rate: ${cacheStats.hitRate}`);
                status = 'degraded';
            }

            // Check for high error rate
            const errorRate = cacheStats.totalRequests > 0
                ? (cacheStats.errors / cacheStats.totalRequests) * 100
                : 0;
            if (errorRate > 5) {
                issues.push(`High cache error rate: ${errorRate.toFixed(2)}%`);
                status = 'degraded';
            }

            // Check for excessive expired entries
            if (cacheStats.expiredEntries > cacheStats.activeEntries * 0.5) {
                issues.push(`High number of expired entries: ${cacheStats.expiredEntries}`);
                status = status === 'healthy' ? 'degraded' : status;
            }

            // Test cache operations
            const testKey = `health_check_${Date.now()}`;
            const testValue = { test: true, timestamp: Date.now() };

            try {
                // Test set
                await this.cacheManager.set(testKey, testValue, 5000);

                // Test get
                const retrieved = await this.cacheManager.get(testKey);
                if (!retrieved || retrieved.test !== true) {
                    issues.push('Cache read/write test failed');
                    status = 'unhealthy';
                }

                // Test delete
                await this.cacheManager.delete(testKey);
            } catch (error) {
                issues.push(`Cache operation test failed: ${error.message}`);
                status = 'unhealthy';
            }

            return {
                status,
                stats: cacheStats,
                issues,
                timestamp: Date.now()
            };
        } catch (error) {
            issues.push(`Cache check failed: ${error.message}`);

            return {
                status: 'unhealthy',
                error: error.message,
                issues,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Check migration status
     * @returns {Promise<Object>} Migration status check result
     */
    async checkMigrations() {
        const issues = [];
        let status = 'healthy';

        try {
            if (!this.migrationManager) {
                return {
                    status: 'skipped',
                    message: 'Migration manager not configured',
                    timestamp: Date.now()
                };
            }

            // Get migration status
            const migrationStatus = await this.migrationManager.getStatus();

            // Check for pending migrations
            if (migrationStatus.pending > 0) {
                issues.push(`${migrationStatus.pending} pending migration(s)`);
                status = 'degraded';
            }

            // Note: Having no migrations is normal and not an issue
            // Only pending migrations are a concern

            return {
                status,
                migrationStatus,
                issues,
                timestamp: Date.now()
            };
        } catch (error) {
            issues.push(`Migration check failed: ${error.message}`);

            return {
                status: 'unhealthy',
                error: error.message,
                issues,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Start periodic health checks
     * @param {number} interval - Check interval in milliseconds (optional)
     */
    startPeriodicChecks(interval = null) {
        if (this.periodicCheckTimer) {
            this.log('Periodic health checks already running', 'warn');
            return;
        }

        const checkInterval = interval || this.config.checkInterval;

        this.log(`Starting periodic health checks (interval: ${checkInterval}ms)`, 'info');

        // Run initial check
        this.checkHealth().catch(error => {
            this.log(`Initial health check error: ${error.message}`, 'error');
        });

        // Schedule periodic checks
        this.periodicCheckTimer = setInterval(async () => {
            try {
                await this.checkHealth();
            } catch (error) {
                this.log(`Periodic health check error: ${error.message}`, 'error');
            }
        }, checkInterval);

        // Don't prevent process from exiting
        if (this.periodicCheckTimer.unref) {
            this.periodicCheckTimer.unref();
        }
    }

    /**
     * Stop periodic health checks
     */
    stopPeriodicChecks() {
        if (this.periodicCheckTimer) {
            clearInterval(this.periodicCheckTimer);
            this.periodicCheckTimer = null;
            this.log('Periodic health checks stopped', 'info');
        }
    }

    /**
     * Get the last health check result
     * @returns {Object|null} Last health check result or null if no checks performed
     */
    getLastCheckResult() {
        return this.lastCheckResult;
    }

    /**
     * Get health check statistics
     * @returns {Object} Health check statistics
     */
    getStats() {
        return {
            ...this.stats,
            lastCheckTime: this.lastCheckTime,
            lastCheckStatus: this.lastCheckResult?.status || null,
            consecutiveFailures: this.consecutiveFailures,
            periodicChecksEnabled: this.periodicCheckTimer !== null,
            checkInterval: this.config.checkInterval
        };
    }

    /**
     * Reset health check statistics
     */
    resetStats() {
        this.stats = {
            totalChecks: 0,
            successfulChecks: 0,
            failedChecks: 0,
            degradedChecks: 0,
            averageResponseTime: 0,
            responseTimes: []
        };
        this.consecutiveFailures = 0;

        this.log('Health check statistics reset', 'info');
    }

    /**
     * Shutdown health check service
     */
    shutdown() {
        this.log('Shutting down health check service', 'info');

        // Stop periodic checks
        this.stopPeriodicChecks();

        // Log final statistics
        const finalStats = this.getStats();
        this.log('Final health check statistics', 'info', finalStats);
    }

    /**
     * Log message with HealthCheckService context
     * @param {string} message - Log message
     * @param {string} level - Log level
     * @param {Object} metadata - Additional metadata
     * @private
     */
    log(message, level = 'info', metadata = {}) {
        if (this.logger && typeof this.logger[level] === 'function') {
            if (Object.keys(metadata).length > 0) {
                this.logger[level](`[HealthCheckService] ${message}`, metadata);
            } else {
                this.logger[level](`[HealthCheckService] ${message}`);
            }
        }
    }
}

module.exports = HealthCheckService;
