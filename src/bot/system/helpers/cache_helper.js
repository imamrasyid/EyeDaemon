/**
 * LRU Cache Helper
 * 
 * Implements a Least Recently Used (LRU) cache with TTL support.
 * Automatically evicts least recently used items when max size is reached.
 */

class LRUCache {
    /**
     * Create a new LRU cache
     * @param {Object} options - Cache options
     * @param {number} options.maxSize - Maximum number of entries (default: 100)
     * @param {number} options.ttl - Time to live in milliseconds (default: 10 minutes)
     */
    constructor(options = {}) {
        this.maxSize = options.maxSize || 100;
        this.ttl = options.ttl || 10 * 60 * 1000; // 10 minutes default

        // Use Map to maintain insertion order
        this.cache = new Map();

        // Track statistics
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
        };
    }

    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @returns {*} Cached value or undefined
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return undefined;
        }

        // Check if expired
        const now = Date.now();
        if (now - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            this.stats.misses++;
            return undefined;
        }

        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, {
            value: entry.value,
            timestamp: now, // Update timestamp on access
        });

        this.stats.hits++;
        return entry.value;
    }

    /**
     * Set value in cache
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     */
    set(key, value) {
        // Remove existing entry if present
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // Check if we need to evict
        if (this.cache.size >= this.maxSize) {
            // Evict least recently used (first entry)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            this.stats.evictions++;
        }

        // Add new entry
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
        });
    }

    /**
     * Check if key exists in cache
     * @param {string} key - Cache key
     * @returns {boolean} True if key exists and not expired
     */
    has(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            return false;
        }

        // Check if expired
        const now = Date.now();
        if (now - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Delete entry from cache
     * @param {string} key - Cache key
     * @returns {boolean} True if entry was deleted
     */
    delete(key) {
        return this.cache.delete(key);
    }

    /**
     * Clear all entries from cache
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Get cache size
     * @returns {number} Number of entries in cache
     */
    get size() {
        return this.cache.size;
    }

    /**
     * Cleanup expired entries
     * @returns {number} Number of entries removed
     */
    cleanup() {
        const now = Date.now();
        let removed = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.ttl) {
                this.cache.delete(key);
                removed++;
            }
        }

        return removed;
    }

    /**
     * Get cache statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;

        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            evictions: this.stats.evictions,
            hitRate: `${hitRate}%`,
            size: this.cache.size,
            maxSize: this.maxSize,
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
        };
    }
}

module.exports = { LRUCache };
