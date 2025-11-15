/**
 * PreparedStatementCache
 * 
 * LRU cache for prepared SQL statements to improve query performance.
 * Caches prepared statements and reuses them to avoid repeated parsing.
 */

class PreparedStatementCache {
    /**
     * Create a new PreparedStatementCache
     * @param {Object} options - Cache configuration
     */
    constructor(options = {}) {
        this.maxSize = options.maxSize || 100;
        this.cache = new Map();
        this.accessOrder = [];

        // Statistics
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            totalRequests: 0
        };
    }

    /**
     * Get a prepared statement from cache or create new one
     * @param {string} sql - SQL query
     * @param {Function} createFn - Function to create prepared statement if not cached
     * @returns {Object} Prepared statement
     */
    get(sql, createFn) {
        this.stats.totalRequests++;

        // Check if statement is in cache
        if (this.cache.has(sql)) {
            this.stats.hits++;

            // Update access order (move to end = most recently used)
            const index = this.accessOrder.indexOf(sql);
            if (index > -1) {
                this.accessOrder.splice(index, 1);
            }
            this.accessOrder.push(sql);

            return this.cache.get(sql);
        }

        // Cache miss - create new prepared statement
        this.stats.misses++;
        const statement = createFn(sql);

        // Add to cache
        this.set(sql, statement);

        return statement;
    }

    /**
     * Add a prepared statement to cache
     * @param {string} sql - SQL query
     * @param {Object} statement - Prepared statement
     */
    set(sql, statement) {
        // Check if we need to evict
        if (this.cache.size >= this.maxSize && !this.cache.has(sql)) {
            this.evictLRU();
        }

        // Add to cache
        this.cache.set(sql, statement);
        this.accessOrder.push(sql);
    }

    /**
     * Evict least recently used statement
     * @private
     */
    evictLRU() {
        if (this.accessOrder.length === 0) {
            return;
        }

        // Remove least recently used (first in access order)
        const lruKey = this.accessOrder.shift();
        this.cache.delete(lruKey);
        this.stats.evictions++;
    }

    /**
     * Clear all cached statements
     */
    clear() {
        this.cache.clear();
        this.accessOrder = [];
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        const hitRate = this.stats.totalRequests > 0
            ? (this.stats.hits / this.stats.totalRequests * 100).toFixed(2)
            : 0;

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.stats.hits,
            misses: this.stats.misses,
            evictions: this.stats.evictions,
            totalRequests: this.stats.totalRequests,
            hitRate: `${hitRate}%`
        };
    }

    /**
     * Reset cache statistics
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            totalRequests: 0
        };
    }

    /**
     * Check if a statement is cached
     * @param {string} sql - SQL query
     * @returns {boolean} True if cached
     */
    has(sql) {
        return this.cache.has(sql);
    }

    /**
     * Get current cache size
     * @returns {number} Number of cached statements
     */
    size() {
        return this.cache.size;
    }
}

module.exports = PreparedStatementCache;
