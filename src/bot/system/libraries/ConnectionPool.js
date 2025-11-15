/**
 * ConnectionPool Library
 * 
 * Manages a pool of database connections for efficient resource usage.
 * Provides connection acquisition, release, and lifecycle management.
 * 
 * Features:
 * - Automatic connection pooling with configurable min/max connections
 * - Connection validation and health checks
 * - Request queuing with timeout handling (FIFO)
 * - Idle connection cleanup
 * - Graceful shutdown with active connection draining
 * - Comprehensive statistics and monitoring
 * 
 * Usage:
 * ```javascript
 * const pool = new ConnectionPool({
 *   minConnections: 2,
 *   maxConnections: 10,
 *   idleTimeout: 30000,
 *   queueTimeout: 5000,
 *   url: process.env.TURSO_DATABASE_URL,
 *   authToken: process.env.TURSO_AUTH_TOKEN,
 *   logger: console
 * });
 * 
 * await pool.initialize();
 * 
 * // Acquire a connection
 * const client = await pool.acquire();
 * try {
 *   await client.execute('SELECT * FROM users');
 * } finally {
 *   await pool.release(client);
 * }
 * 
 * // Get statistics
 * const stats = pool.getStats();
 * console.log(stats);
 * 
 * // Health check
 * const health = await pool.healthCheck();
 * console.log(health);
 * 
 * // Graceful shutdown
 * await pool.drain();
 * ```
 */

const { createClient } = require('@libsql/client');
const { DatabaseError } = require('../core/Errors');

class ConnectionPool {
    /**
     * Create a new ConnectionPool instance
     * @param {Object} config - Pool configuration
     * @param {number} config.minConnections - Minimum number of connections (default: 2)
     * @param {number} config.maxConnections - Maximum number of connections (default: 10)
     * @param {number} config.idleTimeout - Idle connection timeout in ms (default: 30000)
     * @param {number} config.queueTimeout - Queue wait timeout in ms (default: 5000)
     * @param {string} config.url - Turso database URL
     * @param {string} config.authToken - Turso auth token
     * @param {Object} config.logger - Logger instance
     */
    constructor(config = {}) {
        // Pool configuration
        this.minConnections = config.minConnections || 2;
        this.maxConnections = config.maxConnections || 10;
        this.idleTimeout = config.idleTimeout || 30000;
        this.queueTimeout = config.queueTimeout || 5000;
        this.maxQueueSize = config.maxQueueSize || 100; // Maximum queue size

        // Database configuration
        this.dbConfig = {
            url: config.url || process.env.TURSO_DATABASE_URL,
            authToken: config.authToken || process.env.TURSO_AUTH_TOKEN,
            syncUrl: config.syncUrl || process.env.TURSO_SYNC_URL,
            syncInterval: config.syncInterval || 60000,
            encryptionKey: config.encryptionKey || process.env.TURSO_ENCRYPTION_KEY,
        };

        // Validate required configuration
        if (!this.dbConfig.url) {
            throw new DatabaseError('TURSO_DATABASE_URL is required for connection pool', {
                config: 'missing url'
            });
        }

        if (!this.dbConfig.authToken) {
            throw new DatabaseError('TURSO_AUTH_TOKEN is required for connection pool', {
                config: 'missing authToken'
            });
        }

        this.logger = config.logger || console;

        // Pool state
        this.pool = [];              // Array of connection objects
        this.activeConnections = 0;  // Count of connections in use
        this.queue = [];             // Queue of waiting requests
        this.isShuttingDown = false; // Shutdown flag
        this.initialized = false;    // Initialization flag

        // Statistics
        this.stats = {
            totalCreated: 0,
            totalAcquired: 0,
            totalReleased: 0,
            totalDestroyed: 0,
            totalTimeouts: 0,
            totalErrors: 0,
            queueWaitTimes: []
        };

        // Idle connection cleanup interval
        this.cleanupInterval = null;
    }

    /**
     * Initialize the connection pool with minimum connections
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        this.log('Initializing connection pool', 'info', {
            minConnections: this.minConnections,
            maxConnections: this.maxConnections
        });

        try {
            // Create minimum number of connections
            const connectionPromises = [];
            for (let i = 0; i < this.minConnections; i++) {
                connectionPromises.push(this._createConnection());
            }

            await Promise.all(connectionPromises);

            this.initialized = true;

            // Start idle connection cleanup
            this._startCleanupInterval();

            this.log('Connection pool initialized successfully', 'info', {
                poolSize: this.pool.length
            });
        } catch (error) {
            this.log('Failed to initialize connection pool', 'error', {
                error: error.message
            });
            throw new DatabaseError('Connection pool initialization failed', {
                originalError: error.message
            });
        }
    }

    /**
     * Create a new database connection
     * @returns {Promise<Object>} Connection object
     * @private
     */
    async _createConnection() {
        try {
            const client = createClient({
                url: this.dbConfig.url,
                authToken: this.dbConfig.authToken,
                syncUrl: this.dbConfig.syncUrl,
                syncInterval: this.dbConfig.syncInterval,
                encryptionKey: this.dbConfig.encryptionKey,
            });

            // Test connection
            await client.execute('SELECT 1');

            const connection = {
                id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                client,
                inUse: false,
                createdAt: Date.now(),
                lastUsedAt: Date.now(),
                usageCount: 0
            };

            this.pool.push(connection);
            this.stats.totalCreated++;

            this.log('Connection created', 'debug', {
                connectionId: connection.id,
                poolSize: this.pool.length
            });

            return connection;
        } catch (error) {
            this.stats.totalErrors++;
            throw new DatabaseError('Failed to create database connection', {
                originalError: error.message
            });
        }
    }

    /**
     * Acquire a connection from the pool
     * @returns {Promise<Object>} Database client
     */
    async acquire() {
        if (this.isShuttingDown) {
            throw new DatabaseError('Connection pool is shutting down', {
                state: 'shutting_down'
            });
        }

        if (!this.initialized) {
            await this.initialize();
        }

        const startTime = Date.now();

        // Try to get an available connection
        const connection = await this._getAvailableConnection();

        if (connection) {
            const waitTime = Date.now() - startTime;
            this.stats.queueWaitTimes.push(waitTime);

            // Keep only last 100 wait times for statistics
            if (this.stats.queueWaitTimes.length > 100) {
                this.stats.queueWaitTimes.shift();
            }

            return connection.client;
        }

        // No connection available, queue the request
        return new Promise((resolve, reject) => {
            // Check queue overflow
            if (this.queue.length >= this.maxQueueSize) {
                this.stats.totalErrors++;
                this.log('Queue overflow - rejecting request', 'error', {
                    queueLength: this.queue.length,
                    maxQueueSize: this.maxQueueSize,
                    activeConnections: this.activeConnections,
                    poolSize: this.pool.length
                });

                reject(new DatabaseError('Connection pool queue is full', {
                    queueLength: this.queue.length,
                    maxQueueSize: this.maxQueueSize,
                    activeConnections: this.activeConnections
                }));
                return;
            }

            const timeoutId = setTimeout(() => {
                // Remove from queue (FIFO - remove this specific request)
                const index = this.queue.findIndex(item => item.timeoutId === timeoutId);
                if (index !== -1) {
                    this.queue.splice(index, 1);
                }

                this.stats.totalTimeouts++;
                this.log('Connection acquisition timeout', 'warn', {
                    queueLength: this.queue.length,
                    activeConnections: this.activeConnections,
                    poolSize: this.pool.length
                });

                reject(new DatabaseError('Connection acquisition timeout', {
                    timeout: this.queueTimeout,
                    queueLength: this.queue.length
                }));
            }, this.queueTimeout);

            // Add to queue (FIFO - push to end)
            this.queue.push({
                resolve,
                reject,
                timeoutId,
                queuedAt: Date.now()
            });

            this.log('Request queued', 'debug', {
                queueLength: this.queue.length,
                queuePosition: this.queue.length
            });
        });
    }

    /**
     * Get an available connection from the pool
     * @returns {Promise<Object|null>} Connection object or null
     * @private
     */
    async _getAvailableConnection() {
        // Find idle connection
        let connection = this.pool.find(conn => !conn.inUse);

        if (connection) {
            // Validate connection before reuse
            const isValid = await this._validateConnection(connection);

            if (!isValid) {
                // Remove invalid connection and create new one
                await this._destroyConnection(connection);

                if (this.pool.length < this.maxConnections) {
                    connection = await this._createConnection();
                } else {
                    return null;
                }
            }
        } else if (this.pool.length < this.maxConnections) {
            // Create new connection if under max limit
            connection = await this._createConnection();
        } else {
            // Pool is full and all connections are in use
            return null;
        }

        // Mark connection as in use
        connection.inUse = true;
        connection.lastUsedAt = Date.now();
        connection.usageCount++;
        this.activeConnections++;
        this.stats.totalAcquired++;

        this.log('Connection acquired', 'debug', {
            connectionId: connection.id,
            activeConnections: this.activeConnections,
            poolSize: this.pool.length
        });

        return connection;
    }

    /**
     * Validate a connection before reuse
     * @param {Object} connection - Connection object
     * @returns {Promise<boolean>} True if connection is valid
     * @private
     */
    async _validateConnection(connection) {
        try {
            // Simple ping query to validate connection
            await connection.client.execute('SELECT 1');
            return true;
        } catch (error) {
            this.log('Connection validation failed', 'warn', {
                connectionId: connection.id,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Release a connection back to the pool
     * @param {Object} client - Database client to release
     * @returns {Promise<void>}
     */
    async release(client) {
        // Find the connection object
        const connection = this.pool.find(conn => conn.client === client);

        if (!connection) {
            this.log('Attempted to release unknown connection', 'warn');
            return;
        }

        if (!connection.inUse) {
            this.log('Attempted to release connection that is not in use', 'warn', {
                connectionId: connection.id
            });
            return;
        }

        // Mark connection as available
        connection.inUse = false;
        connection.lastUsedAt = Date.now();
        this.activeConnections--;
        this.stats.totalReleased++;

        this.log('Connection released', 'debug', {
            connectionId: connection.id,
            activeConnections: this.activeConnections,
            poolSize: this.pool.length
        });

        // Process queued requests
        await this._processQueue();
    }

    /**
     * Process queued connection requests
     * @returns {Promise<void>}
     * @private
     */
    async _processQueue() {
        if (this.queue.length === 0) {
            return;
        }

        // Get next request from queue (FIFO)
        const request = this.queue.shift();

        if (!request) {
            return;
        }

        // Clear timeout
        clearTimeout(request.timeoutId);

        try {
            // Get available connection
            const connection = await this._getAvailableConnection();

            if (connection) {
                const waitTime = Date.now() - request.queuedAt;
                this.stats.queueWaitTimes.push(waitTime);

                this.log('Queued request fulfilled', 'debug', {
                    waitTime,
                    queueLength: this.queue.length
                });

                request.resolve(connection.client);
            } else {
                // No connection available, put back in queue
                this.queue.unshift(request);
            }
        } catch (error) {
            this.stats.totalErrors++;
            request.reject(error);
        }
    }

    /**
     * Destroy a connection
     * @param {Object} connection - Connection object to destroy
     * @returns {Promise<void>}
     * @private
     */
    async _destroyConnection(connection) {
        try {
            // Close the client connection
            await connection.client.close();

            // Remove from pool
            const index = this.pool.findIndex(conn => conn.id === connection.id);
            if (index !== -1) {
                this.pool.splice(index, 1);
            }

            if (connection.inUse) {
                this.activeConnections--;
            }

            this.stats.totalDestroyed++;

            this.log('Connection destroyed', 'debug', {
                connectionId: connection.id,
                poolSize: this.pool.length
            });
        } catch (error) {
            this.log('Error destroying connection', 'error', {
                connectionId: connection.id,
                error: error.message
            });
        }
    }

    /**
     * Start idle connection cleanup interval
     * @private
     */
    _startCleanupInterval() {
        if (this.cleanupInterval) {
            return;
        }

        this.cleanupInterval = setInterval(async () => {
            await this._cleanupIdleConnections();
        }, this.idleTimeout);

        // Don't prevent process from exiting
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }

    /**
     * Clean up idle connections that exceed idle timeout
     * @returns {Promise<void>}
     * @private
     */
    async _cleanupIdleConnections() {
        const now = Date.now();
        const connectionsToDestroy = [];

        for (const connection of this.pool) {
            // Skip connections in use
            if (connection.inUse) {
                continue;
            }

            // Check if connection has been idle too long
            const idleTime = now - connection.lastUsedAt;
            if (idleTime > this.idleTimeout && this.pool.length > this.minConnections) {
                connectionsToDestroy.push(connection);
            }
        }

        if (connectionsToDestroy.length > 0) {
            this.log('Cleaning up idle connections', 'debug', {
                count: connectionsToDestroy.length,
                poolSize: this.pool.length
            });

            for (const connection of connectionsToDestroy) {
                await this._destroyConnection(connection);
            }
        }
    }

    /**
     * Drain the connection pool and close all connections
     * @param {number} timeout - Maximum time to wait for active connections (default: 30000ms)
     * @returns {Promise<void>}
     */
    async drain(timeout = 30000) {
        if (this.isShuttingDown) {
            this.log('Pool is already shutting down', 'warn');
            return;
        }

        this.isShuttingDown = true;
        this.log('Starting graceful shutdown', 'info', {
            poolSize: this.pool.length,
            activeConnections: this.activeConnections,
            queueLength: this.queue.length
        });

        // Stop cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        // Reject all queued requests
        while (this.queue.length > 0) {
            const request = this.queue.shift();
            clearTimeout(request.timeoutId);
            request.reject(new DatabaseError('Connection pool is shutting down', {
                state: 'draining'
            }));
        }

        this.log('Rejected all queued requests', 'debug', {
            rejectedCount: this.queue.length
        });

        // Close all idle connections immediately
        const idleConnections = this.pool.filter(conn => !conn.inUse);
        for (const connection of idleConnections) {
            await this._destroyConnection(connection);
        }

        this.log('Closed all idle connections', 'debug', {
            closedCount: idleConnections.length
        });

        // Wait for active connections to finish (with timeout)
        if (this.activeConnections > 0) {
            this.log('Waiting for active connections to finish', 'info', {
                activeConnections: this.activeConnections,
                timeout
            });

            const startTime = Date.now();
            const checkInterval = 100; // Check every 100ms

            while (this.activeConnections > 0 && (Date.now() - startTime) < timeout) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }

            if (this.activeConnections > 0) {
                this.log('Timeout waiting for active connections - forcing close', 'warn', {
                    remainingActive: this.activeConnections,
                    waitedMs: Date.now() - startTime
                });
            } else {
                this.log('All active connections finished', 'info', {
                    waitedMs: Date.now() - startTime
                });
            }
        }

        // Force close any remaining connections
        const remainingConnections = [...this.pool];
        for (const connection of remainingConnections) {
            await this._destroyConnection(connection);
        }

        this.initialized = false;

        this.log('Connection pool shutdown complete', 'info', {
            finalStats: {
                totalCreated: this.stats.totalCreated,
                totalDestroyed: this.stats.totalDestroyed,
                totalAcquired: this.stats.totalAcquired,
                totalReleased: this.stats.totalReleased,
                totalTimeouts: this.stats.totalTimeouts,
                totalErrors: this.stats.totalErrors
            }
        });
    }

    /**
     * Get pool statistics
     * @returns {Object} Pool statistics
     */
    getStats() {
        const idleConnections = this.pool.filter(conn => !conn.inUse).length;
        const avgWaitTime = this.stats.queueWaitTimes.length > 0
            ? this.stats.queueWaitTimes.reduce((a, b) => a + b, 0) / this.stats.queueWaitTimes.length
            : 0;

        return {
            // Pool state
            poolSize: this.pool.length,
            activeConnections: this.activeConnections,
            idleConnections,
            queueLength: this.queue.length,

            // Configuration
            minConnections: this.minConnections,
            maxConnections: this.maxConnections,
            maxQueueSize: this.maxQueueSize,

            // Lifecycle stats
            totalCreated: this.stats.totalCreated,
            totalAcquired: this.stats.totalAcquired,
            totalReleased: this.stats.totalReleased,
            totalDestroyed: this.stats.totalDestroyed,

            // Performance stats
            totalTimeouts: this.stats.totalTimeouts,
            totalErrors: this.stats.totalErrors,
            averageWaitTime: Math.round(avgWaitTime),

            // State flags
            isInitialized: this.initialized,
            isShuttingDown: this.isShuttingDown,

            // Connection details
            connections: this.pool.map(conn => ({
                id: conn.id,
                inUse: conn.inUse,
                usageCount: conn.usageCount,
                ageMs: Date.now() - conn.createdAt,
                idleMs: Date.now() - conn.lastUsedAt
            }))
        };
    }

    /**
     * Perform health check on the connection pool
     * @returns {Promise<Object>} Health check result
     */
    async healthCheck() {
        const stats = this.getStats();
        const issues = [];
        let status = 'healthy';

        // Check if pool is initialized
        if (!this.initialized) {
            issues.push('Pool not initialized');
            status = 'unhealthy';
        }

        // Check if shutting down
        if (this.isShuttingDown) {
            issues.push('Pool is shutting down');
            status = 'unhealthy';
        }

        // Check if pool has minimum connections
        if (stats.poolSize < this.minConnections) {
            issues.push(`Pool size (${stats.poolSize}) below minimum (${this.minConnections})`);
            status = 'degraded';
        }

        // Check if queue is backing up
        if (stats.queueLength > this.maxQueueSize * 0.8) {
            issues.push(`Queue length (${stats.queueLength}) approaching maximum (${this.maxQueueSize})`);
            status = status === 'healthy' ? 'degraded' : status;
        }

        // Check if all connections are in use
        if (stats.activeConnections === stats.poolSize && stats.poolSize === this.maxConnections) {
            issues.push('All connections in use and pool at maximum capacity');
            status = status === 'healthy' ? 'degraded' : status;
        }

        // Check timeout rate
        const timeoutRate = stats.totalAcquired > 0
            ? (stats.totalTimeouts / stats.totalAcquired) * 100
            : 0;
        if (timeoutRate > 5) {
            issues.push(`High timeout rate: ${timeoutRate.toFixed(2)}%`);
            status = status === 'healthy' ? 'degraded' : status;
        }

        // Test a connection if available
        let connectionTest = null;
        try {
            const idleConnection = this.pool.find(conn => !conn.inUse);
            if (idleConnection) {
                const testStart = Date.now();
                await idleConnection.client.execute('SELECT 1');
                connectionTest = {
                    success: true,
                    responseTime: Date.now() - testStart
                };
            }
        } catch (error) {
            connectionTest = {
                success: false,
                error: error.message
            };
            issues.push(`Connection test failed: ${error.message}`);
            status = 'unhealthy';
        }

        return {
            status,
            timestamp: Date.now(),
            stats,
            issues,
            connectionTest
        };
    }

    /**
     * Log pool statistics
     * @param {string} level - Log level (default: 'info')
     */
    logStats(level = 'info') {
        const stats = this.getStats();

        this.log('Pool statistics', level, {
            poolSize: stats.poolSize,
            active: stats.activeConnections,
            idle: stats.idleConnections,
            queued: stats.queueLength,
            totalAcquired: stats.totalAcquired,
            totalReleased: stats.totalReleased,
            totalTimeouts: stats.totalTimeouts,
            totalErrors: stats.totalErrors,
            avgWaitTime: stats.averageWaitTime
        });
    }

    /**
     * Log message with ConnectionPool context
     * @param {string} message - Log message
     * @param {string} level - Log level
     * @param {Object} metadata - Additional metadata
     * @private
     */
    log(message, level = 'info', metadata = {}) {
        if (this.logger && typeof this.logger[level] === 'function') {
            if (Object.keys(metadata).length > 0) {
                this.logger[level](`[ConnectionPool] ${message}`, metadata);
            } else {
                this.logger[level](`[ConnectionPool] ${message}`);
            }
        }
    }
}

module.exports = ConnectionPool;
