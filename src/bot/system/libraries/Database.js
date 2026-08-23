'use strict';

/**
 * Database Library
 * 
 * Manages LibSQL client connection (local SQLite file or remote Turso DB).
 * Provides robust query interface, retry logic, connection pooling, and transactions.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');
const { DatabaseError } = require('../core/Errors');
const { retryWithBackoff, shouldRetryError } = require('../helpers/RetryHelper');
const PreparedStatementCache = require('./PreparedStatementCache');
const QueryPerformanceLogger = require('./QueryPerformanceLogger');
const QueryOptimizer = require('./QueryOptimizer');
const QueryMetricsTracker = require('./QueryMetricsTracker');
const TransactionManager = require('./TransactionManager');

class DatabaseLibrary {
    /**
     * Create a new Database instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Database configuration options
     */
    constructor(client, options = {}) {
        this.client = client;
        this.logger = client?.logger || console;

        const defaultUrl = 'file:./data/eyedaemon.db';
        const url = options.url || process.env.TURSO_DATABASE_URL || defaultUrl;
        const authToken = options.authToken || process.env.TURSO_AUTH_TOKEN || null;

        // Database configuration
        this.config = {
            url,
            authToken,
            syncUrl: options.syncUrl || process.env.TURSO_SYNC_URL || null,
            syncInterval: options.syncInterval || 60000,
            encryptionKey: options.encryptionKey || process.env.TURSO_ENCRYPTION_KEY || null,
            ...options
        };

        // Determine if local or remote
        this.isRemote = this.config.url.startsWith('libsql://') ||
                        this.config.url.startsWith('https://') ||
                        this.config.url.startsWith('http://');

        // Validate auth token only for remote databases
        if (this.isRemote && !this.config.authToken) {
            throw new DatabaseError('TURSO_AUTH_TOKEN is required for remote Turso connection', {
                url: this.config.url
            });
        }

        // Auto-create local database directory if file URL
        if (this.config.url.startsWith('file:')) {
            const rawPath = this.config.url.replace(/^file:/, '');
            if (rawPath && rawPath !== ':memory:' && !rawPath.startsWith(':memory:')) {
                const resolvedDir = path.dirname(path.resolve(process.cwd(), rawPath));
                try {
                    if (!fs.existsSync(resolvedDir)) {
                        fs.mkdirSync(resolvedDir, { recursive: true });
                    }
                } catch (fsErr) {
                    this.log(`Failed to create database directory ${resolvedDir}: ${fsErr.message}`, 'warn');
                }
            }
        }

        this.db = null;
        this.isConnected = false;
        this.transactionDepth = 0;

        // Initialize transaction manager (fully initialized on connect)
        this.transactionManager = null;

        // Initialize prepared statement cache
        this.preparedStatementCache = new PreparedStatementCache({
            maxSize: options.cacheSize || 100
        });

        // Initialize query performance logger (adaptive threshold: 2500ms for remote Turso, 500ms for local SQLite)
        const defaultSlowThreshold = this.isRemote ? 2500 : 500;
        this.performanceLogger = new QueryPerformanceLogger({
            slowQueryThreshold: options.slowQueryThreshold || Number(process.env.DB_SLOW_QUERY_THRESHOLD) || defaultSlowThreshold,
            logger: this.logger,
            enabled: options.enablePerformanceLogging !== false
        });

        // Initialize query optimizer
        this.queryOptimizer = new QueryOptimizer(this);

        // Initialize query metrics tracker
        this.metricsTracker = new QueryMetricsTracker({
            logger: this.logger,
            enabled: options.enableMetricsTracking !== false,
            avgThreshold: options.avgThreshold || (this.isRemote ? 1500 : 300),
            p95Threshold: options.p95Threshold || (this.isRemote ? 2500 : 600),
            p99Threshold: options.p99Threshold || (this.isRemote ? 4000 : 1000)
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
                    const clientConfig = {
                        url: this.config.url,
                    };

                    if (this.config.authToken) {
                        clientConfig.authToken = this.config.authToken;
                    }
                    if (this.config.syncUrl) {
                        clientConfig.syncUrl = this.config.syncUrl;
                    }
                    if (this.config.syncInterval) {
                        clientConfig.syncInterval = this.config.syncInterval;
                    }
                    if (this.config.encryptionKey) {
                        clientConfig.encryptionKey = this.config.encryptionKey;
                    }

                    // Create LibSQL client
                    this.db = createClient(clientConfig);

                    // Test connection with a simple query
                    await this.db.execute('SELECT 1');

                    this.isConnected = true;
                    const dbType = this.isRemote ? 'Remote Turso DB' : 'Local SQLite DB';
                    this.log(`Database connected successfully to ${dbType} (${this.config.url})`, 'info');

                    // Initialize transaction manager with database wrapper
                    this.transactionManager = new TransactionManager(this, {
                        maxRetries: this.config.maxRetries || 3,
                        initialDelay: this.config.initialDelay || 100,
                        maxDelay: this.config.maxDelay || 5000,
                        backoffMultiplier: this.config.backoffMultiplier || 2,
                        defaultTimeout: this.config.transactionTimeout || 30000,
                        deadlockRetryDelay: this.config.deadlockRetryDelay || 50
                    });

                    // Initialize database schema
                    const { initializeSchema } = require('../helpers/DatabaseHelper');
                    await initializeSchema(this);
                } catch (error) {
                    this.log(`Failed to connect to database: ${error.message}`, 'error');
                    throw new DatabaseError('Failed to connect to Database', {
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

        const startTime = Date.now();
        let success = true;
        let error = null;

        try {
            const result = await retryWithBackoff(
                async () => {
                    try {
                        const queryType = sql.trim().toUpperCase().split(' ')[0];

                        const result = await this.db.execute({
                            sql,
                            args: params
                        });

                        if (queryType === 'SELECT' || queryType === 'PRAGMA') {
                            return result.rows || [];
                        } else if (queryType === 'INSERT' || queryType === 'UPDATE' || queryType === 'DELETE') {
                            return {
                                changes: result.rowsAffected || 0,
                                rowsAffected: result.rowsAffected || 0,
                                lastInsertRowid: result.lastInsertRowid || null
                            };
                        } else {
                            return {
                                changes: result.rowsAffected || 0,
                                rowsAffected: result.rowsAffected || 0
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
            const executionTime = Date.now() - startTime;
            this.performanceLogger.logQuery(sql, params, executionTime, success, error);
            this.metricsTracker.recordExecutionTime(executionTime);
        }
    }

    /**
     * Check if error is a LibSQL retryable error
     * @param {Error} error
     * @returns {boolean}
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

        return this.preparedStatementCache.get(sql, (statementSql) => {
            const dbRef = this;
            return {
                sql: statementSql,

                async run(...params) {
                    const args = Array.isArray(params[0]) && params.length === 1 ? params[0] : params;
                    return await dbRef.query(statementSql, args);
                },

                async all(...params) {
                    const args = Array.isArray(params[0]) && params.length === 1 ? params[0] : params;
                    const res = await dbRef.query(statementSql, args);
                    return Array.isArray(res) ? res : [];
                },

                async get(...params) {
                    const args = Array.isArray(params[0]) && params.length === 1 ? params[0] : params;
                    return await dbRef.queryOne(statementSql, args);
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
     * @param {number} limit
     * @returns {Array}
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
     * @returns {QueryOptimizer}
     */
    getOptimizer() {
        return this.queryOptimizer;
    }

    /**
     * Analyze a query for optimization opportunities
     * @param {string} sql
     * @param {Array} params
     * @returns {Object}
     */
    analyzeQuery(sql, params = []) {
        return this.queryOptimizer.analyzeQuery(sql, params);
    }

    /**
     * Get index recommendations based on query history
     * @returns {Array<Object>}
     */
    getIndexRecommendations() {
        const queryHistory = this.performanceLogger.queryHistory;
        return this.queryOptimizer.suggestIndexes(queryHistory);
    }

    /**
     * Get query execution metrics (avg, p95, p99)
     * @returns {Object}
     */
    getQueryMetrics() {
        return this.metricsTracker.getMetrics();
    }

    /**
     * Set performance baseline
     */
    setPerformanceBaseline() {
        this.metricsTracker.setBaseline();
        this.log('Performance baseline set', 'info');
    }

    /**
     * Get degradation alerts
     * @returns {Array<Object>}
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
     * @returns {Array<Object>}
     */
    checkMetricThresholds() {
        return this.metricsTracker.checkThresholds();
    }

    /**
     * Generate comprehensive metrics report
     * @returns {Object}
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
     * @param {Object} options
     * @returns {Promise<void>}
     */
    async beginTransaction(options = {}) {
        if (!this.isConnected || !this.db) {
            throw new DatabaseError('Database connection not available', {
                isConnected: this.isConnected,
                hasDb: this.db !== null
            });
        }

        if (!this.transactionManager) {
            throw new DatabaseError('Transaction manager not initialized', {
                isConnected: this.isConnected
            });
        }

        try {
            await this.transactionManager.begin(options);
            this.transactionDepth = this.transactionManager.getDepth();
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

        if (!this.transactionManager) {
            throw new DatabaseError('Transaction manager not initialized', {
                isConnected: this.isConnected
            });
        }

        try {
            await this.transactionManager.commit();
            this.transactionDepth = this.transactionManager.getDepth();
            this.log(`Transaction committed (depth: ${this.transactionDepth})`, 'debug');
        } catch (error) {
            this.transactionDepth = this.transactionManager.getDepth();
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

        if (!this.transactionManager) {
            throw new DatabaseError('Transaction manager not initialized', {
                isConnected: this.isConnected
            });
        }

        try {
            await this.transactionManager.rollback();
            this.transactionDepth = this.transactionManager.getDepth();
            this.log(`Transaction rolled back (depth: ${this.transactionDepth})`, 'debug');
        } catch (error) {
            this.transactionDepth = this.transactionManager.getDepth();
            throw new DatabaseError('Failed to rollback transaction', {
                originalError: error.message,
                transactionDepth: this.transactionDepth
            });
        }
    }

    /**
     * Execute multiple statements in a transaction
     * @param {Function} callback
     * @param {Object} options
     * @returns {Promise<any>}
     */
    async transaction(callback, options = {}) {
        if (!this.transactionManager) {
            throw new DatabaseError('Transaction manager not initialized', {
                isConnected: this.isConnected
            });
        }

        try {
            const result = await this.transactionManager.execute(async (txWrapper) => {
                this.transactionDepth = this.transactionManager.getDepth();
                return await callback(txWrapper);
            }, options);

            this.transactionDepth = this.transactionManager.getDepth();
            return result;
        } catch (error) {
            this.transactionDepth = this.transactionManager.getDepth();
            this.log(`Transaction failed and rolled back: ${error.message}`, 'error');

            throw new DatabaseError('Transaction failed', {
                originalError: error.message,
                transactionDepth: this.transactionDepth
            });
        }
    }

    /**
     * Execute transaction with automatic deadlock retry
     * @param {Function} callback
     * @param {Object} options
     * @returns {Promise<any>}
     */
    async transactionWithRetry(callback, options = {}) {
        if (!this.transactionManager) {
            throw new DatabaseError('Transaction manager not initialized', {
                isConnected: this.isConnected
            });
        }

        try {
            const result = await this.transactionManager.executeWithRetry(async (txWrapper) => {
                this.transactionDepth = this.transactionManager.getDepth();
                return await callback(txWrapper);
            }, options);

            this.transactionDepth = this.transactionManager.getDepth();
            return result;
        } catch (error) {
            this.transactionDepth = this.transactionManager.getDepth();
            this.log(`Transaction with retry failed: ${error.message}`, 'error');

            throw new DatabaseError('Transaction with retry failed', {
                originalError: error.message,
                transactionDepth: this.transactionDepth,
                stats: this.transactionManager.getStats()
            });
        }
    }

    /**
     * Recover from transaction depth inconsistency
     * @returns {Promise<void>}
     */
    async recoverTransactionDepth() {
        if (!this.transactionManager) {
            this.transactionDepth = 0;
            return;
        }

        try {
            await this.transactionManager.recoverDepth();
            this.transactionDepth = this.transactionManager.getDepth();
            this.log('Transaction depth recovered', 'info');
        } catch (error) {
            this.transactionDepth = 0;
            throw new DatabaseError('Failed to recover transaction depth', {
                originalError: error.message
            });
        }
    }

    /**
     * Validate transaction depth consistency
     * @returns {boolean}
     */
    validateTransactionDepth() {
        if (!this.transactionManager) {
            return this.transactionDepth === 0;
        }

        const isConsistent = this.transactionManager.validateDepth();
        const managerDepth = this.transactionManager.getDepth();

        if (this.transactionDepth !== managerDepth) {
            this.transactionDepth = managerDepth;
        }

        return isConsistent;
    }

    /**
     * Get transaction statistics
     * @returns {Object}
     */
    getTransactionStats() {
        if (!this.transactionManager) {
            return {
                currentDepth: this.transactionDepth,
                managerAvailable: false
            };
        }

        return this.transactionManager.getStats();
    }

    /**
     * Check if currently in a transaction
     * @returns {boolean}
     */
    isInTransaction() {
        if (!this.transactionManager) {
            return this.transactionDepth > 0;
        }

        return this.transactionManager.isInTransaction();
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

        if (ids.length < batchSize) {
            const placeholders = ids.map(() => '?').join(', ');
            const sql = `DELETE FROM ${table} WHERE ${idColumn} IN (${placeholders})`;
            const result = await this.query(sql, ids);

            return {
                totalDeleted: result.changes || 0,
                results: [result]
            };
        }

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
