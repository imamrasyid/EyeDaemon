/**
 * CacheInvalidator Class
 * 
 * Manages cache invalidation untuk maintain consistency antara cache dan database.
 * Implements cache-aside pattern, stampede prevention, dan atomic invalidation.
 */

const { DatabaseError } = require('../core/Errors');

class CacheInvalidator {
    /**
     * Create a new CacheInvalidator instance
     * @param {Object} cacheManager - CacheManager instance
     * @param {Object} mutexManager - MutexManager instance for stampede prevention
     * @param {Object} options - Configuration options
     */
    constructor(cacheManager, mutexManager, options = {}) {
        if (!cacheManager) {
            throw new Error('CacheManager is required');
        }
        if (!mutexManager) {
            throw new Error('MutexManager is required');
        }

        this.cache = cacheManager;
        this.mutex = mutexManager;
        this.options = {
            stampedeTimeout: options.stampedeTimeout || 5000,
            defaultTTL: options.defaultTTL || 600000, // 10 minutes
            ...options
        };

        this.stats = {
            invalidations: 0,
            patternInvalidations: 0,
            stampedePrevented: 0,
            cacheAsideHits: 0,
            cacheAsideMisses: 0,
            errors: 0
        };
    }

    /**
     * Invalidate cache entries
     * @param {Array<string>} keys - Cache keys to invalidate
     * @returns {Promise<void>}
     */
    async invalidate(keys) {
        if (!Array.isArray(keys) || keys.length === 0) {
            return;
        }

        try {
            // Delete all specified keys
            await Promise.all(keys.map(key => this.cache.delete(key)));
            this.stats.invalidations += keys.length;
        } catch (error) {
            this.stats.errors++;
            throw new Error(`Failed to invalidate cache keys: ${error.message}`);
        }
    }

    /**
     * Invalidate cache pattern
     * @param {string} pattern - Pattern to match (supports wildcards)
     * @returns {Promise<number>} Number of keys invalidated
     */
    async invalidatePattern(pattern) {
        try {
            // For database-backed cache, we need to query matching keys
            // This is a simplified implementation - in production you might want
            // to use a more sophisticated pattern matching
            const sql = `SELECT key FROM ${this.cache.config.tableName} WHERE key LIKE ?`;
            const likePattern = pattern.replace(/\*/g, '%');

            const rows = await this.cache.database.query(sql, [likePattern]);
            const keys = rows.map(row => row.key);

            if (keys.length > 0) {
                await this.invalidate(keys);
                this.stats.patternInvalidations++;
            }

            return keys.length;
        } catch (error) {
            this.stats.errors++;
            throw new Error(`Failed to invalidate pattern ${pattern}: ${error.message}`);
        }
    }

    /**
     * Execute with cache invalidation
     * @param {Function} fn - Function to execute
     * @param {Array<string>} keys - Keys to invalidate after execution
     * @returns {Promise<any>} Function result
     */
    async withInvalidation(fn, keys) {
        try {
            // Execute function
            const result = await fn();

            // Invalidate cache keys after successful execution
            await this.invalidate(keys);

            return result;
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Cache-aside pattern: get from cache or fetch from source
     * @param {string} key - Cache key
     * @param {Function} fetchFn - Function to fetch data if cache miss
     * @param {number} ttl - Time to live in milliseconds
     * @returns {Promise<any>} Cached or fetched data
     */
    async getOrFetch(key, fetchFn, ttl = null) {
        try {
            // Try to get from cache
            const cached = await this.cache.get(key);

            if (cached !== null) {
                this.stats.cacheAsideHits++;
                return cached;
            }

            // Cache miss - use mutex to prevent stampede
            const lockKey = `cache-fetch:${key}`;

            return await this.mutex.withLock(lockKey, async () => {
                // Double-check cache after acquiring lock
                const cachedAfterLock = await this.cache.get(key);

                if (cachedAfterLock !== null) {
                    this.stats.cacheAsideHits++;
                    this.stats.stampedePrevented++;
                    return cachedAfterLock;
                }

                // Fetch from source
                this.stats.cacheAsideMisses++;
                const data = await fetchFn();

                // Store in cache
                await this.cache.set(key, data, ttl || this.options.defaultTTL);

                return data;
            }, this.options.stampedeTimeout);
        } catch (error) {
            this.stats.errors++;
            throw new Error(`Cache-aside operation failed for key ${key}: ${error.message}`);
        }
    }

    /**
     * Update cache and database atomically
     * @param {string} key - Cache key
     * @param {Function} updateFn - Function to update database
     * @param {any} newValue - New value to cache
     * @param {number} ttl - Time to live in milliseconds
     * @returns {Promise<any>} Update result
     */
    async updateAtomic(key, updateFn, newValue, ttl = null) {
        try {
            // Execute database update
            const result = await updateFn();

            // Update cache with new value
            await this.cache.set(key, newValue, ttl || this.options.defaultTTL);

            return result;
        } catch (error) {
            // On error, invalidate cache to prevent stale data
            try {
                await this.cache.delete(key);
            } catch (invalidateError) {
                // Log but don't throw - original error is more important
                console.error(`Failed to invalidate cache on error: ${invalidateError.message}`);
            }

            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Delete from cache and database atomically
     * @param {string} key - Cache key
     * @param {Function} deleteFn - Function to delete from database
     * @returns {Promise<any>} Delete result
     */
    async deleteAtomic(key, deleteFn) {
        try {
            // Execute database delete
            const result = await deleteFn();

            // Delete from cache
            await this.cache.delete(key);

            return result;
        } catch (error) {
            // On error, invalidate cache to prevent stale data
            try {
                await this.cache.delete(key);
            } catch (invalidateError) {
                // Log but don't throw
                console.error(`Failed to invalidate cache on error: ${invalidateError.message}`);
            }

            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Batch invalidate with transaction
     * @param {Array<string>} keys - Keys to invalidate
     * @param {Function} updateFn - Function to update database
     * @returns {Promise<any>} Update result
     */
    async batchInvalidate(keys, updateFn) {
        try {
            // Execute database update
            const result = await updateFn();

            // Invalidate all keys
            await this.invalidate(keys);

            return result;
        } catch (error) {
            // On error, invalidate all keys to prevent stale data
            try {
                await this.invalidate(keys);
            } catch (invalidateError) {
                // Log but don't throw
                console.error(`Failed to invalidate cache on error: ${invalidateError.message}`);
            }

            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Refresh cache entry
     * @param {string} key - Cache key
     * @param {Function} fetchFn - Function to fetch fresh data
     * @param {number} ttl - Time to live in milliseconds
     * @returns {Promise<any>} Fresh data
     */
    async refresh(key, fetchFn, ttl = null) {
        try {
            // Fetch fresh data
            const data = await fetchFn();

            // Update cache
            await this.cache.set(key, data, ttl || this.options.defaultTTL);

            return data;
        } catch (error) {
            this.stats.errors++;
            throw new Error(`Failed to refresh cache key ${key}: ${error.message}`);
        }
    }

    /**
     * Warm up cache with data
     * @param {Object} entries - Object with key-value pairs
     * @param {number} ttl - Time to live in milliseconds
     * @returns {Promise<void>}
     */
    async warmUp(entries, ttl = null) {
        try {
            const promises = Object.entries(entries).map(([key, value]) =>
                this.cache.set(key, value, ttl || this.options.defaultTTL)
            );

            await Promise.all(promises);
        } catch (error) {
            this.stats.errors++;
            throw new Error(`Failed to warm up cache: ${error.message}`);
        }
    }

    /**
     * Get statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            ...this.stats,
            cacheHitRate: this.stats.cacheAsideHits + this.stats.cacheAsideMisses > 0
                ? ((this.stats.cacheAsideHits / (this.stats.cacheAsideHits + this.stats.cacheAsideMisses)) * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            invalidations: 0,
            patternInvalidations: 0,
            stampedePrevented: 0,
            cacheAsideHits: 0,
            cacheAsideMisses: 0,
            errors: 0
        };
    }
}

module.exports = CacheInvalidator;
