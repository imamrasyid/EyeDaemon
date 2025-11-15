/**
 * Database Library
 * 
 * Manages Turso DB connection using LibSQL client.
 * Provides query interface and connection management.
 */

const { createClient } = require('@libsql/client');
const { DatabaseError } = require('../core/Errors');
const { retryWithBackoff, shouldRetryError } = require('../helpers/retry_helper');
const PreparedStatementCache = require('./PreparedStatementCache');
const QueryPerformanceLogger = require('./QueryPerformanceLogger');
const QueryOptimizer = require('./QueryOptimizer');
const QueryMetricsTracker = require('./QueryMetricsTracker');

class DatabaseLibrary {
    /**
     * Create a new Database instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Database configuration options
     */
    constructor(client, options = {}) {
        this.client = client;
        this.logger = client.logger || console;

        // Database configuration
        this.config = {
            url: options.url || process.env.TURSO_DATABASE_URL,
            authToken: options.authToken || process.env.TURSO_AUTH_TOKEN,
            syncUrl: options.syncUrl || process.env.TURSO_SYNC_URL,
            syncInterval: options.syncInterval || 60000,
            encryptionKey: options.encryptionKey || process.env.TURSO_ENCRYPTION_KEY,
            ...options
        };

        // Validate required configuration
        if (!this.config.url) {
            throw new DatabaseError('TURSO_DATABASE_URL is required', {
                config: 'missing url'
            });
        }

        if (!this.config.authToken) {
            throw new DatabaseError('TURSO_AUTH_TOKEN is required', {
                config: 'missing authToken'
            });
        }

        this.db = null;
        this.isConnected = false;
        this.transactionDepth = 0;

        // Initialize prepared statement cache
        this.preparedStatementCache = new PreparedStatementCache({
            maxSize: options.cacheSize || 100
        });

        // Initialize query performance logger
        this.performanceLogger = new QueryPerformanceLogger({
            slowQueryThreshold: options.slowQueryThreshold || 1000,
            logger: this.logger,
            enabled: options.enablePerformanceLogging !== false
        });

        // Initialize query optimizer
        this.queryOptimizer = new QueryOptimizer(this);

        // Initialize query metrics tracker
        this.metricsTracker = new QueryMetricsTracker({
            logger: this.logger,
            enabled: options.enableMetricsTracking !== false,
            avgThreshold: options.avgThreshold || 500,
            p95Threshold: options.p95Threshold || 1000,
            p99Threshold: options.p99Threshold || 2000
        });
    }

    /**
     * Initialize database connection with retry logic
     * @returns {Promise<void>}
     */
    async connect() {
        return await retryWithBackoff(
            async () => {
                try {
                    // Create LibSQL client
                    this.db = createClient({
                        url: this.config.url,
                        authToken: this.config.authToken,
                        syncUrl: this.config.syncUrl,
                        syncInterval: this.config.syncInterval,
                        encryptionKey: this.config.encryptionKey,
                    });

                    // Test connection with a simple query
                    await this.db.execute('SELECT 1');

                    this.isConnected = true;
                    this.log('Database connected successfully to Turso DB', 'info');

                    // Initialize database schema
                    const { initializeSchema } = require('../helpers/database_helper');
                    await initializeSchema(this);
                } catch (error) {
                    this.log(`Failed to connect to database: ${error.message}`, 'error');
                    throw new DatabaseError('Failed to connect to Turso DB', {
                        originalError: error.message,
                        url: this.config.url
                    });
                }
            },
            {
                maxRetries: 3,
                initialDelay: 1000,
                maxDelay: 5000,
                backoffMultiplier: 2,
                shouldRetry: (error) => {
                    // Retry on network errors and connection issues
                    return shouldRetryError(error) || this._isLibSQLRetryableError(error);
                },
                onRetry: (error, attempt) => {
                    this.log(`Retrying database connection (attempt ${attempt + 1})`, 'warn', {
                        error: error.message
                    });
                }
            }
        );
    }

    /**
     * Close database connection
     * @returns {Promise<void>}
     */
    async close() {
        if (this.db) {
            try {
                await this.db.close();
                this.isConnected = false;
                this.log('Database connection closed', 'info');
            } catch (error) {
                this.log(`Error closing database: ${error.message}`, 'error');
                throw new DatabaseError('Failed to close database connection', {
                    originalError: error.message
                });
            }
        }
    }

    /**
     * Check if database is connected
     * @returns {boolean}
     */
    isReady() {
        return this.isConnected && this.db !== null;
    }

    /**
     * Execute a SQL query with retry logic and performance logging
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<Array|Object>} Query results
     */
    async query(sql, params = []) {
        if (!this.isConnected || !this.db) {
            throw new DatabaseError('Database connection not available', {
                isConnected: this.isConnected,
                hasDb: this.db !== null
            });
        }

        // Start performance tracking
        const startTime = Date.now();
        let success = true;
        let error = null;

        try {
            // Execute query with retry logic
            const result = await retryWithBackoff(
                async () => {
                    try {
                        // Determine query type
                        const queryType = sql.trim().toUpperCase().split(' ')[0];

                        // Execute query with LibSQL
                        const result = await this.db.execute({
                            sql,
                            args: params
                        });

                        // Format response based on query type
                        if (queryType === 'SELECT') {
                            // SELECT queries return rows
                            return result.rows || [];
                        } else if (queryType === 'INSERT' || queryType === 'UPDATE' || queryType === 'DELETE') {
                            // INSERT/UPDATE/DELETE queries return metadata
                            return {
                                changes: result.rowsAffected || 0,
                                lastInsertRowid: result.lastInsertRowid || null
                            };
                        } else {
                            // Other queries (CREATE, DROP, etc.)
                            return {
                                changes: result.rowsAffected || 0
                            };
                        }
                    } catch (err) {
                        this.log(`Query error: ${err.message}`, 'error', { sql, params });
                        throw new DatabaseError('Query execution failed', {
                            originalError: err.message,
                            sql,
                            params
                        });
                    }
                },
                {
                    maxRetries: 3,
                    initialDelay: 100,
                    maxDelay: 1000,
                    backoffMultiplier: 2,
                    shouldRetry: (error) => {
                        // Retry on network errors, timeouts, and busy errors
                        return shouldRetryError(error) || this._isLibSQLRetryableError(error);
                    },
                    onRetry: (error, attempt) => {
                        this.log(`Retrying query (attempt ${attempt + 1})`, 'warn', {
                            error: error.message,
                            sql,
                            params
                        });
                    }
                }
            );

            return result;
        } catch (err) {
            success = false;
            error = err;
            throw err;
        } finally {
            // Log performance and track metrics
            const executionTime = Date.now() - startTime;
            this.performanceLogger.logQuery(sql, params, executionTime, success, error);
            this.metricsTracker.recordExecutionTime(executionTime);
        }
    }

    /**
     * Check if error is a LibSQL retryable error
     * @param {Error} error - The error to check
     * @returns {boolean} True if error should be retried
     * @private
     */
    _isLibSQLRetryableError(error) {
        const message = error.message?.toLowerCase() || '';
        const retryablePatterns = [
            'sqlite_busy',
            'database is locked',
            'database busy',
            'timeout',
            'connection',
            'network',
            'econnreset',
            'etimedout',
            'enotfound'
        ];

        return retryablePatterns.some(pattern => message.includes(pattern));
    }

    /**
     * Execute a query and return the first row
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<Object|null>} First row or null
     */
    async queryOne(sql, params = []) {
        const results = await this.query(sql, params);

        if (Array.isArray(results) && results.length > 0) {
            return results[0];
        }

        return null;
    }

    /**
     * Prepare a SQL statement for reuse (with caching)
     * @param {string} sql - SQL query
     * @returns {Object} Prepared statement object
     */
    prepare(sql) {
        if (!this.isConnected || !this.db) {
            throw new DatabaseError('Database connection not available', {
                isConnected: this.isConnected,
                hasDb: this.db !== null
            });
        }

        // Get from cache or create new prepared statement
        return this.preparedStatementCache.get(sql, (sql) => {
            // Return a wrapper object that mimics prepared statement interface
            return {
                sql,
                db: this.db,

                /**
                 * Execute prepared statement with parameters
                 * @param {Array} params - Query parameters
                 * @returns {Promise<Array|Object>} Query results
                 */
                async run(...params) {
                    const result = await this.db.execute({
                        sql: this.sql,
                        args: params
                    });

                    return {
                        changes: result.rowsAffected || 0,
                        lastInsertRowid: result.lastInsertRowid || null
                    };
                },

                /**
                 * Execute prepared statement and return all rows
                 * @param {Array} params - Query parameters
                 * @returns {Promise<Array>} All rows
                 */
                async all(...params) {
                    const result = await this.db.execute({
                        sql: this.sql,
                        args: params
                    });

                    return result.rows || [];
                },

                /**
                 * Execute prepared statement and return first row
                 * @param {Array} params - Query parameters
                 * @returns {Promise<Object|null>} First row or null
                 */
                async get(...params) {
                    const result = await this.db.execute({
                        sql: this.sql,
                        args: params
                    });

                    const rows = result.rows || [];
                    return rows.length > 0 ? rows[0] : null;
                }
            };
        });
    }

    /**
     * Get prepared statement cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        return this.preparedStatementCache.getStats();
    }

    /**
     * Clear prepared statement cache
     */
    clearCache() {
        this.preparedStatementCache.clear();
        this.log('Prepared statement cache cleared', 'debug');
    }

    /**
     * Get query performance statistics
     * @returns {Object} Performance statistics
     */
    getPerformanceStats() {
        return this.performanceLogger.getStats();
    }

    /**
     * Generate performance report
     * @returns {Object} Detailed performance report
     */
    generatePerformanceReport() {
        return this.performanceLogger.generateReport();
    }

    /**
     * Get recent slow queries
     * @param {number} limit - Maximum number of queries to return
     * @returns {Array} Recent slow queries
     */
    getRecentSlowQueries(limit = 10) {
        return this.performanceLogger.getRecentSlowQueries(limit);
    }

    /**
     * Reset performance statistics
     */
    resetPerformanceStats() {
        this.performanceLogger.resetStats();
        this.log('Performance statistics reset', 'debug');
    }

    /**
     * Enable performance logging
     */
    enablePerformanceLogging() {
        this.performanceLogger.enable();
        this.log('Performance logging enabled', 'info');
    }

    /**
     * Disable performance logging
     */
    disablePerformanceLogging() {
        this.performanceLogger.disable();
        this.log('Performance logging disabled', 'info');
    }

    /**
     * Get query optimizer instance
     * @returns {QueryOptimizer} Query optimizer
     */
    getOptimizer() {
        return this.queryOptimizer;
    }

    /**
     * Analyze a query for optimization opportunities
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Object} Analysis result with recommendations
     */
    analyzeQuery(sql, params = []) {
        return this.queryOptimizer.analyzeQuery(sql, params);
    }

    /**
     * Get index recommendations based on query history
     * @returns {Array<Object>} Index recommendations
     */
    getIndexRecommendations() {
        const queryHistory = this.performanceLogger.queryHistory;
        return this.queryOptimizer.suggestIndexes(queryHistory);
    }

    /**
     * Get query execution metrics (avg, p95, p99)
     * @returns {Object} Query execution metrics
     */
    getQueryMetrics() {
        return this.metricsTracker.getMetrics();
    }

    /**
     * Set performance baseline for degradation detection
     */
    setPerformanceBaseline() {
        this.metricsTracker.setBaseline();
        this.log('Performance baseline set', 'info');
    }

    /**
     * Get degradation alerts
     * @returns {Array<Object>} Performance degradation alerts
     */
    getDegradationAlerts() {
        return this.metricsTracker.getDegradationAlerts();
    }

    /**
     * Clear degradation alerts
     */
    clearDegradationAlerts() {
        this.metricsTracker.clearDegradationAlerts();
        this.log('Degradation alerts cleared', 'debug');
    }

    /**
     * Check if metrics exceed thresholds
     * @returns {Array<Object>} Threshold violations
     */
    checkMetricThresholds() {
        return this.metricsTracker.checkThresholds();
    }

    /**
     * Generate comprehensive metrics report
     * @returns {Object} Metrics report with performance data and alerts
     */
    generateMetricsReport() {
        return this.metricsTracker.generateReport();
    }

    /**
     * Reset query metrics
     */
    resetQueryMetrics() {
        this.metricsTracker.reset();
        this.log('Query metrics reset', 'debug');
    }

    /**
     * Enable metrics tracking
     */
    enableMetricsTracking() {
        this.metricsTracker.enable();
        this.log('Metrics tracking enabled', 'info');
    }

    /**
     * Disable metrics tracking
     */
    disableMetricsTracking() {
        this.metricsTracker.disable();
        this.log('Metrics tracking disabled', 'info');
    }

    /**
     * Begin a transaction
     * @returns {Promise<void>}
     */
    async beginTransaction() {
        if (!this.isConnected || !this.db) {
            throw new DatabaseError('Database connection not available', {
                isConnected: this.isConnected,
                hasDb: this.db !== null
            });
        }

        try {
            // Support nested transactions with savepoints
            if (this.transactionDepth > 0) {
                await this.db.execute(`SAVEPOINT sp_${this.transactionDepth}`);
            } else {
                await this.db.execute('BEGIN TRANSACTION');
            }

            this.transactionDepth++;
            this.log(`Transaction started (depth: ${this.transactionDepth})`, 'debug');
        } catch (error) {
            throw new DatabaseError('Failed to begin transaction', {
                originalError: error.message,
                transactionDepth: this.transactionDepth
            });
        }
    }

    /**
     * Commit a transaction
     * @returns {Promise<void>}
     */
    async commit() {
        if (!this.isConnected || !this.db) {
            throw new DatabaseError('Database connection not available', {
                isConnected: this.isConnected,
                hasDb: this.db !== null
            });
        }

        if (this.transactionDepth === 0) {
            throw new DatabaseError('No active transaction to commit', {
                transactionDepth: this.transactionDepth
            });
        }

        try {
            this.transactionDepth--;

            // Release savepoint for nested transactions, commit for top-level
            if (this.transactionDepth > 0) {
                await this.db.execute(`RELEASE SAVEPOINT sp_${this.transactionDepth}`);
            } else {
                await this.db.execute('COMMIT');
            }

            this.log(`Transaction committed (depth: ${this.transactionDepth})`, 'debug');
        } catch (error) {
            throw new DatabaseError('Failed to commit transaction', {
                originalError: error.message,
                transactionDepth: this.transactionDepth
            });
        }
    }

    /**
     * Rollback a transaction
     * @returns {Promise<void>}
     */
    async rollback() {
        if (!this.isConnected || !this.db) {
            throw new DatabaseError('Database connection not available', {
                isConnected: this.isConnected,
                hasDb: this.db !== null
            });
        }

        if (this.transactionDepth === 0) {
            throw new DatabaseError('No active transaction to rollback', {
                transactionDepth: this.transactionDepth
            });
        }

        try {
            this.transactionDepth--;

            // Rollback to savepoint for nested transactions, rollback all for top-level
            if (this.transactionDepth > 0) {
                await this.db.execute(`ROLLBACK TO SAVEPOINT sp_${this.transactionDepth}`);
            } else {
                await this.db.execute('ROLLBACK');
            }

            this.log(`Transaction rolled back (depth: ${this.transactionDepth})`, 'debug');
        } catch (error) {
            // Reset transaction depth on rollback error
            this.transactionDepth = 0;

            throw new DatabaseError('Failed to rollback transaction', {
                originalError: error.message,
                transactionDepth: this.transactionDepth
            });
        }
    }

    /**
     * Execute multiple statements in a transaction
     * @param {Function} callback - Callback function to execute
     * @returns {Promise<any>} Result of callback
     */
    async transaction(callback) {
        await this.beginTransaction();

        try {
            const result = await callback(this);
            await this.commit();
            return result;
        } catch (error) {
            await this.rollback();

            this.log(`Transaction failed and rolled back: ${error.message}`, 'error');

            throw new DatabaseError('Transaction failed', {
                originalError: error.message,
                transactionDepth: this.transactionDepth
            });
        }
    }

    /**
     * Execute batch operations with retry logic
     * @param {Array<Object>} statements - Array of {sql, args} objects
     * @returns {Promise<Array>} Array of results
     */
    async batch(statements) {
        if (!this.isConnected || !this.db) {
            throw new DatabaseError('Database connection not available', {
                isConnected: this.isConnected,
                hasDb: this.db !== null
            });
        }

        return await retryWithBackoff(
            async () => {
                try {
                    // LibSQL supports batch operations natively
                    const results = await this.db.batch(statements);
                    return results;
                } catch (error) {
                    this.log(`Batch operation error: ${error.message}`, 'error', {
                        statementCount: statements.length
                    });
                    throw new DatabaseError('Batch operation failed', {
                        originalError: error.message,
                        statementCount: statements.length
                    });
                }
            },
            {
                maxRetries: 3,
                initialDelay: 100,
                maxDelay: 1000,
                backoffMultiplier: 2,
                shouldRetry: (error) => {
                    return shouldRetryError(error) || this._isLibSQLRetryableError(error);
                },
                onRetry: (error, attempt) => {
                    this.log(`Retrying batch operation (attempt ${attempt + 1})`, 'warn', {
                        error: error.message,
                        statementCount: statements.length
                    });
                }
            }
        );
    }

    /**
     * Batch insert multiple records with transaction
     * @param {string} table - Table name
     * @param {Array<Object>} records - Array of records to insert
     * @param {number} batchSize - Minimum batch size (default: 10)
     * @returns {Promise<Object>} Insert results
     */
    async batchInsert(table, records, batchSize = 10) {
        if (!Array.isArray(records) || records.length === 0) {
            throw new DatabaseError('Records must be a non-empty array', {
                table,
                recordCount: records?.length || 0
            });
        }

        // If less than batch size, use regular inserts
        if (records.length < batchSize) {
            return await this.transaction(async () => {
                const results = [];
                for (const record of records) {
                    const columns = Object.keys(record);
                    const placeholders = columns.map(() => '?').join(', ');
                    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
                    const result = await this.query(sql, Object.values(record));
                    results.push(result);
                }
                return {
                    totalInserted: results.length,
                    results
                };
            });
        }

        // Use batch operation for larger datasets
        const statements = records.map(record => {
            const columns = Object.keys(record);
            const placeholders = columns.map(() => '?').join(', ');
            const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
            return {
                sql,
                args: Object.values(record)
            };
        });

        const results = await this.batch(statements);

        this.log(`Batch insert completed: ${records.length} records into ${table}`, 'debug');

        return {
            totalInserted: records.length,
            results
        };
    }

    /**
     * Batch update multiple records with transaction
     * @param {string} table - Table name
     * @param {Array<Object>} updates - Array of {where, data} objects
     * @param {number} batchSize - Minimum batch size (default: 10)
     * @returns {Promise<Object>} Update results
     */
    async batchUpdate(table, updates, batchSize = 10) {
        if (!Array.isArray(updates) || updates.length === 0) {
            throw new DatabaseError('Updates must be a non-empty array', {
                table,
                updateCount: updates?.length || 0
            });
        }

        // If less than batch size, use regular updates
        if (updates.length < batchSize) {
            return await this.transaction(async () => {
                const results = [];
                for (const update of updates) {
                    const { where, data } = update;
                    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
                    const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
                    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
                    const params = [...Object.values(data), ...Object.values(where)];
                    const result = await this.query(sql, params);
                    results.push(result);
                }
                return {
                    totalUpdated: results.reduce((sum, r) => sum + (r.changes || 0), 0),
                    results
                };
            });
        }

        // Use batch operation for larger datasets
        const statements = updates.map(update => {
            const { where, data } = update;
            const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
            const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
            const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
            const params = [...Object.values(data), ...Object.values(where)];
            return {
                sql,
                args: params
            };
        });

        const results = await this.batch(statements);
        const totalUpdated = results.reduce((sum, r) => sum + (r.rowsAffected || 0), 0);

        this.log(`Batch update completed: ${totalUpdated} records in ${table}`, 'debug');

        return {
            totalUpdated,
            results
        };
    }

    /**
     * Batch delete multiple records with transaction
     * @param {string} table - Table name
     * @param {Array<string|number>} ids - Array of IDs to delete
     * @param {string} idColumn - ID column name (default: 'id')
     * @param {number} batchSize - Minimum batch size (default: 10)
     * @returns {Promise<Object>} Delete results
     */
    async batchDelete(table, ids, idColumn = 'id', batchSize = 10) {
        if (!Array.isArray(ids) || ids.length === 0) {
            throw new DatabaseError('IDs must be a non-empty array', {
                table,
                idCount: ids?.length || 0
            });
        }

        // If less than batch size, use IN clause
        if (ids.length < batchSize) {
            const placeholders = ids.map(() => '?').join(', ');
            const sql = `DELETE FROM ${table} WHERE ${idColumn} IN (${placeholders})`;
            const result = await this.query(sql, ids);

            return {
                totalDeleted: result.changes || 0,
                results: [result]
            };
        }

        // Use batch operation for larger datasets
        const statements = ids.map(id => ({
            sql: `DELETE FROM ${table} WHERE ${idColumn} = ?`,
            args: [id]
        }));

        const results = await this.batch(statements);
        const totalDeleted = results.reduce((sum, r) => sum + (r.rowsAffected || 0), 0);

        this.log(`Batch delete completed: ${totalDeleted} records from ${table}`, 'debug');

        return {
            totalDeleted,
            results
        };
    }

    /**
     * Log message with Database context
     * @param {string} message - Log message
     * @param {string} level - Log level
     * @param {Object} metadata - Additional metadata
     */
    log(message, level = 'info', metadata = {}) {
        if (this.logger && typeof this.logger[level] === 'function') {
            if (Object.keys(metadata).length > 0) {
                this.logger[level](`[Database] ${message}`, metadata);
            } else {
                this.logger[level](`[Database] ${message}`);
            }
        }
    }
}

module.exports = DatabaseLibrary;
