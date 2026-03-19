/**
 * MutexManager Class
 *
 * In-memory mutex untuk mencegah race conditions pada critical sections.
 * Menggunakan Map of Promises — zero latency, zero network, cocok untuk single-process bot.
 */

const crypto = require('crypto');

function generateUniqueId() {
    return crypto.randomBytes(16).toString('hex');
}

class MutexManager {
    /**
     * @param {Object} _database - Diabaikan (kept for API compatibility)
     * @param {Object} options - Configuration options
     */
    constructor(_database = null, options = {}) {
        this.options = {
            defaultTimeout: options.defaultTimeout || 5000,
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 100,
            ...options
        };

        this.ownerId = options.ownerId || `mutex-${generateUniqueId()}`;

        // Map<key, { promise, resolve, token, expiresAt }>
        this._locks = new Map();

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
     * Acquire a mutex lock
     * @param {string} key
     * @param {number} timeout - ms
     * @returns {Promise<string>} token
     */
    async acquire(key, timeout = null) {
        const lockTimeout = timeout || this.options.defaultTimeout;
        const token = generateUniqueId();
        const expiresAt = Date.now() + lockTimeout;

        if (this._locks.has(key)) {
            const existing = this._locks.get(key);
            // If expired, evict it
            if (existing.expiresAt < Date.now()) {
                this._locks.delete(key);
                this.stats.expiredLocksRemoved++;
            } else {
                this.stats.locksFailed++;
                throw new Error(`Failed to acquire lock for key: ${key}`);
            }
        }

        let resolveFn;
        const promise = new Promise(resolve => { resolveFn = resolve; });
        this._locks.set(key, { promise, resolve: resolveFn, token, expiresAt });

        this.stats.locksAcquired++;
        return token;
    }

    /**
     * Release a mutex lock
     * @param {string} key
     * @param {string} token
     * @returns {Promise<boolean>}
     */
    async release(key, token) {
        const lock = this._locks.get(key);
        if (!lock || lock.token !== token) {
            return false;
        }
        lock.resolve();
        this._locks.delete(key);
        this.stats.locksReleased++;
        return true;
    }

    /**
     * Execute function with mutex lock
     * @param {string} key
     * @param {Function} fn
     * @param {number} timeout
     * @returns {Promise<any>}
     */
    async withLock(key, fn, timeout = null) {
        let token = null;
        let retries = 0;

        while (retries < this.options.maxRetries) {
            try {
                token = await this.acquire(key, timeout);
                break;
            } catch (error) {
                retries++;
                if (retries >= this.options.maxRetries) throw error;
                await this.sleep(this.options.retryDelay * Math.pow(2, retries - 1));
            }
        }

        try {
            return await fn();
        } finally {
            if (token) await this.release(key, token);
        }
    }

    /**
     * Try to acquire lock without throwing
     * @param {string} key
     * @param {number} timeout
     * @returns {Promise<string|null>}
     */
    async tryAcquire(key, timeout = null) {
        try {
            return await this.acquire(key, timeout);
        } catch {
            return null;
        }
    }

    /**
     * Check if lock exists and is valid
     * @param {string} key
     * @returns {Promise<boolean>}
     */
    async isLocked(key) {
        const lock = this._locks.get(key);
        if (!lock) return false;
        if (lock.expiresAt < Date.now()) {
            this._locks.delete(key);
            this.stats.expiredLocksRemoved++;
            return false;
        }
        return true;
    }

    /**
     * Extend lock timeout
     * @param {string} key
     * @param {string} token
     * @param {number} additionalTime - ms
     * @returns {Promise<boolean>}
     */
    async extend(key, token, additionalTime) {
        const lock = this._locks.get(key);
        if (!lock || lock.token !== token) return false;
        if (lock.expiresAt < Date.now()) return false;
        lock.expiresAt += additionalTime;
        return true;
    }

    /**
     * Cleanup expired locks
     * @returns {Promise<number>}
     */
    async cleanup() {
        const now = Date.now();
        let removed = 0;
        for (const [key, lock] of this._locks) {
            if (lock.expiresAt < now) {
                lock.resolve(); // unblock any waiters
                this._locks.delete(key);
                removed++;
            }
        }
        this.stats.cleanupRuns++;
        this.stats.expiredLocksRemoved += removed;
        return removed;
    }

    /** No-op — no timer needed for in-memory impl */
    startCleanup() { }
    stopCleanup() { }

    /**
     * Get statistics
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            activeLocksCount: this._locks.size
        };
    }

    /**
     * Get count of active locks
     * @returns {Promise<number>}
     */
    async getActiveLocksCount() {
        return this._locks.size;
    }

    /**
     * Get all active locks (metadata only)
     * @returns {Promise<Array>}
     */
    async getActiveLocks() {
        const now = Date.now();
        return Array.from(this._locks.entries())
            .filter(([, lock]) => lock.expiresAt > now)
            .map(([key, lock]) => ({ lock_key: key, expires_at: lock.expiresAt }));
    }

    /**
     * Force release all locks
     * @returns {Promise<number>}
     */
    async releaseAll() {
        const count = this._locks.size;
        for (const lock of this._locks.values()) lock.resolve();
        this._locks.clear();
        return count;
    }

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

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async shutdown() {
        await this.releaseAll();
    }
}

module.exports = MutexManager;
