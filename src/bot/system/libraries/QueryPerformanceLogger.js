/**
 * QueryPerformanceLogger
 * 
 * Tracks and logs query performance metrics.
 * Logs slow queries and generates performance reports.
 */

class QueryPerformanceLogger {
    /**
     * Create a new QueryPerformanceLogger
     * @param {Object} options - Logger configuration
     */
    constructor(options = {}) {
        this.slowQueryThreshold = options.slowQueryThreshold || 1000; // ms
        this.logger = options.logger || console;
        this.enabled = options.enabled !== false;

        // Query history for reporting
        this.queryHistory = [];
        this.maxHistorySize = options.maxHistorySize || 1000;

        // Statistics
        this.stats = {
            totalQueries: 0,
            slowQueries: 0,
            totalExecutionTime: 0,
            queryTypes: {}
        };
    }

    /**
     * Log a query execution
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @param {number} executionTime - Execution time in milliseconds
     * @param {boolean} success - Whether query succeeded
     * @param {Error} error - Error if query failed
     */
    logQuery(sql, params, executionTime, success = true, error = null) {
        if (!this.enabled) {
            return;
        }

        // Update statistics
        this.stats.totalQueries++;
        this.stats.totalExecutionTime += executionTime;

        // Determine query type
        const queryType = this._getQueryType(sql);
        if (!this.stats.queryTypes[queryType]) {
            this.stats.queryTypes[queryType] = {
                count: 0,
                totalTime: 0,
                avgTime: 0
            };
        }
        this.stats.queryTypes[queryType].count++;
        this.stats.queryTypes[queryType].totalTime += executionTime;
        this.stats.queryTypes[queryType].avgTime =
            this.stats.queryTypes[queryType].totalTime / this.stats.queryTypes[queryType].count;

        // Check if slow query
        const isSlow = executionTime >= this.slowQueryThreshold;
        if (isSlow) {
            this.stats.slowQueries++;
            this._logSlowQuery(sql, params, executionTime, success, error);
        }

        // Add to history
        this._addToHistory({
            sql,
            params,
            executionTime,
            success,
            error: error?.message,
            timestamp: Date.now(),
            queryType,
            isSlow
        });
    }

    /**
     * Log a slow query
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @param {number} executionTime - Execution time in milliseconds
     * @param {boolean} success - Whether query succeeded
     * @param {Error} error - Error if query failed
     * @private
     */
    _logSlowQuery(sql, params, executionTime, success, error) {
        const logLevel = success ? 'warn' : 'error';
        const message = `Slow query detected (${executionTime}ms)`;

        const metadata = {
            sql: this._sanitizeSQL(sql),
            executionTime: `${executionTime}ms`,
            threshold: `${this.slowQueryThreshold}ms`,
            success,
            paramCount: params?.length || 0
        };

        if (error) {
            metadata.error = error.message;
        }

        if (this.logger && typeof this.logger[logLevel] === 'function') {
            this.logger[logLevel](`[QueryPerformance] ${message}`, metadata);
        }
    }

    /**
     * Add query to history
     * @param {Object} queryInfo - Query information
     * @private
     */
    _addToHistory(queryInfo) {
        this.queryHistory.push(queryInfo);

        // Trim history if too large
        if (this.queryHistory.length > this.maxHistorySize) {
            this.queryHistory.shift();
        }
    }

    /**
     * Get query type from SQL
     * @param {string} sql - SQL query
     * @returns {string} Query type
     * @private
     */
    _getQueryType(sql) {
        const normalized = sql.trim().toUpperCase();

        if (normalized.startsWith('SELECT')) return 'SELECT';
        if (normalized.startsWith('INSERT')) return 'INSERT';
        if (normalized.startsWith('UPDATE')) return 'UPDATE';
        if (normalized.startsWith('DELETE')) return 'DELETE';
        if (normalized.startsWith('CREATE')) return 'CREATE';
        if (normalized.startsWith('DROP')) return 'DROP';
        if (normalized.startsWith('ALTER')) return 'ALTER';
        if (normalized.startsWith('BEGIN')) return 'TRANSACTION';
        if (normalized.startsWith('COMMIT')) return 'TRANSACTION';
        if (normalized.startsWith('ROLLBACK')) return 'TRANSACTION';

        return 'OTHER';
    }

    /**
     * Sanitize SQL for logging (remove sensitive data)
     * @param {string} sql - SQL query
     * @returns {string} Sanitized SQL
     * @private
     */
    _sanitizeSQL(sql) {
        // Truncate very long queries
        if (sql.length > 500) {
            return sql.substring(0, 500) + '...';
        }
        return sql;
    }

    /**
     * Generate performance report
     * @returns {Object} Performance report
     */
    generateReport() {
        const avgExecutionTime = this.stats.totalQueries > 0
            ? (this.stats.totalExecutionTime / this.stats.totalQueries).toFixed(2)
            : 0;

        const slowQueryPercentage = this.stats.totalQueries > 0
            ? ((this.stats.slowQueries / this.stats.totalQueries) * 100).toFixed(2)
            : 0;

        // Get slowest queries
        const slowestQueries = this.queryHistory
            .filter(q => q.isSlow)
            .sort((a, b) => b.executionTime - a.executionTime)
            .slice(0, 10)
            .map(q => ({
                sql: this._sanitizeSQL(q.sql),
                executionTime: `${q.executionTime}ms`,
                timestamp: new Date(q.timestamp).toISOString(),
                success: q.success
            }));

        return {
            summary: {
                totalQueries: this.stats.totalQueries,
                slowQueries: this.stats.slowQueries,
                slowQueryPercentage: `${slowQueryPercentage}%`,
                totalExecutionTime: `${this.stats.totalExecutionTime}ms`,
                avgExecutionTime: `${avgExecutionTime}ms`,
                slowQueryThreshold: `${this.slowQueryThreshold}ms`
            },
            queryTypes: this.stats.queryTypes,
            slowestQueries,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Get recent slow queries
     * @param {number} limit - Maximum number of queries to return
     * @returns {Array} Recent slow queries
     */
    getRecentSlowQueries(limit = 10) {
        return this.queryHistory
            .filter(q => q.isSlow)
            .slice(-limit)
            .reverse()
            .map(q => ({
                sql: this._sanitizeSQL(q.sql),
                executionTime: `${q.executionTime}ms`,
                timestamp: new Date(q.timestamp).toISOString(),
                success: q.success,
                error: q.error
            }));
    }

    /**
     * Get statistics
     * @returns {Object} Current statistics
     */
    getStats() {
        return {
            ...this.stats,
            avgExecutionTime: this.stats.totalQueries > 0
                ? (this.stats.totalExecutionTime / this.stats.totalQueries).toFixed(2)
                : 0,
            slowQueryPercentage: this.stats.totalQueries > 0
                ? ((this.stats.slowQueries / this.stats.totalQueries) * 100).toFixed(2)
                : 0
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalQueries: 0,
            slowQueries: 0,
            totalExecutionTime: 0,
            queryTypes: {}
        };
        this.queryHistory = [];
    }

    /**
     * Enable performance logging
     */
    enable() {
        this.enabled = true;
    }

    /**
     * Disable performance logging
     */
    disable() {
        this.enabled = false;
    }

    /**
     * Check if logging is enabled
     * @returns {boolean} True if enabled
     */
    isEnabled() {
        return this.enabled;
    }
}

module.exports = QueryPerformanceLogger;
