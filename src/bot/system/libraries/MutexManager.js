/**
 * MutexManager Class
 * 
 * Manages distributed mutexes untuk mencegah race conditions pada critical sections.
 * Menggunakan database-backed locking dengan TTL dan automatic cleanup.
 */

const crypto = require('crypto');
const { DatabaseError } = require('../core/Errors');

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
function generateUniqueId() {
    return crypto.randomBytes(16).toString('hex');
}

class MutexManager {
    /**
     * Create a new MutexManager instance
     * @param {Object} database - Database instance
     * @param {Object} options - Configuration options
     */
    constructor(database, options = {}) {
        this.db = database;
        this.options = {
            defaultTimeout: options.defaultTimeout || 5000, // 5 seconds default
            cleanupInterval: options.cleanupInterval || 60000, // 1 minute
            cleanupBatchSize: options.cleanupBatchSize || 500, // rows per cleanup batch
            cleanupSleepInterval: options.cleanupSleepInterval || 5, // ms pause between batches
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 100,
            ...options
        };

        this.ownerId = options.ownerId || `mutex-${generateUniqueId()}`;
        this.cleanupTimer = null;
        this.stats = {
            locksAcquired: 0,
            locksReleased: 0,
            locksFailed: 0,
            locksTimedOut: 0,
            cleanupRuns: 0,
            expiredLocksRemoved: 0
        };

        // Start cleanup timer
        this.startCleanup();
    }

    /**
     * Acquire a mutex lock
     * @param {string} key - Lock key
     * @param {number} timeout - Lock timeout in ms
     * @returns {Promise<string>} Lock token
     */
    async acquire(key, timeout = null) {
        const lockTimeout = timeout || this.options.defaultTimeout;
        const token = generateUniqueId();
        const now = Date.now();
        const expiresAt = now + lockTimeout;

        try {
            // Try to insert lock
            const result = await this.db.query(
                `INSERT INTO distributed_locks (lock_key, lock_token, acquired_at, expires_at, owner_id)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(lock_key) DO NOTHING`,
                [key, token, now, expiresAt, this.ownerId]
            );

            // Check if insert succeeded
            if (result.changes > 0) {
                this.stats.locksAcquired++;
                return token;
            }

            // Lock already exists, check if expired
            const existingLock = await this.db.queryOne(
                'SELECT * FROM distributed_locks WHERE lock_key = ?',
                [key]
            );

            if (existingLock && existingLock.expires_at < now) {
                // Lock expired, try to replace it
                const replaceResult = await this.db.query(
                    `UPDATE distributed_locks 
                     SET lock_token = ?, acquired_at = ?, expires_at = ?, owner_id = ?
                     WHERE lock_key = ? AND expires_at < ?`,
                    [token, now, expiresAt, this.ownerId, key, now]
                );

                if (replaceResult.changes > 0) {
                    this.stats.locksAcquired++;
                    return token;
                }
            }

            // Could not acquire lock
            this.stats.locksFailed++;
            throw new Error(`Failed to acquire lock for key: ${key}`);
        } catch (error) {
            this.stats.locksFailed++;
            throw new DatabaseError('Failed to acquire mutex lock', {
                key,
                originalError: error.message
            });
        }
    }

    /**
     * Release a mutex lock
     * @param {string} key - Lock key
     * @param {string} token - Lock token
     * @returns {Promise<boolean>} Success status
     */
    async release(key, token) {
        try {
            const result = await this.db.query(
                'DELETE FROM distributed_locks WHERE lock_key = ? AND lock_token = ?',
                [key, token]
            );

            if (result.changes > 0) {
                this.stats.locksReleased++;
                return true;
            }

            return false;
        } catch (error) {
            throw new DatabaseError('Failed to release mutex lock', {
                key,
                originalError: error.message
            });
        }
    }

    /**
     * Execute function with mutex lock
     * @param {string} key - Lock key
     * @param {Function} fn - Function to execute
     * @param {number} timeout - Lock timeout
     * @returns {Promise<any>} Function result
     */
    async withLock(key, fn, timeout = null) {
        let token = null;
        let retries = 0;

        while (retries < this.options.maxRetries) {
            try {
                // Try to acquire lock
                token = await this.acquire(key, timeout);
                break;
            } catch (error) {
                retries++;
                if (retries >= this.options.maxRetries) {
                    throw error;
                }
                // Wait before retry
                await this.sleep(this.options.retryDelay * Math.pow(2, retries - 1));
            }
        }

        try {
            // Execute function with lock held
            const result = await fn();
            return result;
        } finally {
            // Always release lock
            if (token) {
                await this.release(key, token);
            }
        }
    }

    /**
     * Try to acquire lock without waiting
     * @param {string} key - Lock key
     * @param {number} timeout - Lock timeout in ms
     * @returns {Promise<string|null>} Lock token or null if failed
     */
    async tryAcquire(key, timeout = null) {
        try {
            return await this.acquire(key, timeout);
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if lock exists and is valid
     * @param {string} key - Lock key
     * @returns {Promise<boolean>} True if lock exists and not expired
     */
    async isLocked(key) {
        try {
            const lock = await this.db.queryOne(
                'SELECT * FROM distributed_locks WHERE lock_key = ?',
                [key]
            );

            if (!lock) {
                return false;
            }

            const now = Date.now();
            return lock.expires_at > now;
        } catch (error) {
            throw new DatabaseError('Failed to check lock status', {
                key,
                originalError: error.message
            });
        }
    }

    /**
     * Extend lock timeout
     * @param {string} key - Lock key
     * @param {string} token - Lock token
     * @param {number} additionalTime - Additional time in ms
     * @returns {Promise<boolean>} Success status
     */
    async extend(key, token, additionalTime) {
        try {
            const now = Date.now();
            const result = await this.db.query(
                `UPDATE distributed_locks 
                 SET expires_at = expires_at + ?
                 WHERE lock_key = ? AND lock_token = ? AND expires_at > ?`,
                [additionalTime, key, token, now]
            );

            return result.changes > 0;
        } catch (error) {
            throw new DatabaseError('Failed to extend lock', {
                key,
                originalError: error.message
            });
        }
    }

    /**
     * Cleanup expired locks
     * @returns {Promise<number>} Number of locks removed
     */
    async cleanup() {
        try {
            const now = Date.now();

            // First, check how many expired locks exist
            const countResult = await this.db.queryOne(
                'SELECT COUNT(*) as count FROM distributed_locks WHERE expires_at < ?',
                [now]
            );

            const expiredCount = countResult?.count || 0;

            if (expiredCount === 0) {
                return 0; // Nothing to clean up
            }

            let totalRemoved = 0;

            // If expired count is small, delete all at once for better performance
            if (expiredCount <= this.options.cleanupBatchSize) {
                const result = await this.db.query(
                    'DELETE FROM distributed_locks WHERE expires_at < ?',
                    [now]
                );
                totalRemoved = result.changes || 0;
            } else {
                // For large cleanups, use batching to avoid long locks
                while (true) {
                    // Use lock_key instead of rowid for better index usage
                    const result = await this.db.query(
                        `DELETE FROM distributed_locks 
                         WHERE lock_key IN (
                            SELECT lock_key FROM distributed_locks 
                            WHERE expires_at < ? 
                            LIMIT ?
                         )`,
                        [now, this.options.cleanupBatchSize]
                    );

                    const removed = result.changes || 0;
                    totalRemoved += removed;

                    if (removed < this.options.cleanupBatchSize) {
                        break; // no more expired rows
                    }

                    // Brief pause to prevent long transactions under load
                    await this.sleep(this.options.cleanupSleepInterval);
                }
            }

            this.stats.cleanupRuns++;
            this.stats.expiredLocksRemoved += totalRemoved;

            return totalRemoved;
        } catch (error) {
            throw new DatabaseError('Failed to cleanup expired locks', {
                originalError: error.message
            });
        }
    }

    /**
     * Start automatic cleanup timer
     */
    startCleanup() {
        if (this.cleanupTimer) {
            return;
        }

        this.cleanupTimer = setInterval(async () => {
            try {
                await this.cleanup();
            } catch (error) {
                // Log error but don't throw
                console.error('Mutex cleanup error:', error.message);
            }
        }, this.options.cleanupInterval);

        // Don't prevent process exit
        if (this.cleanupTimer.unref) {
            this.cleanupTimer.unref();
        }
    }

    /**
     * Stop automatic cleanup timer
     */
    stopCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Get lock statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            ...this.stats,
            activeLocksCount: this.getActiveLocksCount()
        };
    }

    /**
     * Get count of active locks
     * @returns {Promise<number>} Count of active locks
     */
    async getActiveLocksCount() {
        try {
            const now = Date.now();
            const result = await this.db.queryOne(
                'SELECT COUNT(*) as count FROM distributed_locks WHERE expires_at > ?',
                [now]
            );
            return result?.count || 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get all active locks
     * @returns {Promise<Array>} Array of active locks
     */
    async getActiveLocks() {
        try {
            const now = Date.now();
            return await this.db.query(
                'SELECT * FROM distributed_locks WHERE expires_at > ? ORDER BY acquired_at',
                [now]
            );
        } catch (error) {
            throw new DatabaseError('Failed to get active locks', {
                originalError: error.message
            });
        }
    }

    /**
     * Force release all locks for this owner
     * @returns {Promise<number>} Number of locks released
     */
    async releaseAll() {
        try {
            const result = await this.db.query(
                'DELETE FROM distributed_locks WHERE owner_id = ?',
                [this.ownerId]
            );

            return result.changes || 0;
        } catch (error) {
            throw new DatabaseError('Failed to release all locks', {
                originalError: error.message
            });
        }
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            locksAcquired: 0,
            locksReleased: 0,
            locksFailed: 0,
            locksTimedOut: 0,
            cleanupRuns: 0,
            expiredLocksRemoved: 0
        };
    }

    /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Shutdown mutex manager
     * @returns {Promise<void>}
     */
    async shutdown() {
        this.stopCleanup();
        await this.releaseAll();
    }
}

module.exports = MutexManager;
