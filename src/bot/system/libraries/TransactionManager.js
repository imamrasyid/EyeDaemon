'use strict';

/**
 * TransactionManager Class
 * 
 * Manages database transactions using LibSQL's native interactive transaction support.
 * Provides safe nesting, automatic commit/rollback, and deadlock retry handling.
 */

const { DatabaseError } = require('../core/Errors');
const { retryWithBackoff, shouldRetryError } = require('../helpers/RetryHelper');

class TransactionManager {
    /**
     * Create a new TransactionManager instance
     * @param {Object} database - Database instance
     * @param {Object} options - Configuration options
     */
    constructor(database, options = {}) {
        this.db = database;
        this.options = {
            maxRetries: options.maxRetries || 3,
            initialDelay: options.initialDelay || 100,
            maxDelay: options.maxDelay || 5000,
            backoffMultiplier: options.backoffMultiplier || 2,
            defaultTimeout: options.defaultTimeout || 30000,
            deadlockRetryDelay: options.deadlockRetryDelay || 50,
            ...options
        };

        this.transactionDepth = 0;
        this.activeTx = null;
        this.activeTxWrapper = null;

        this.stats = {
            transactionsStarted: 0,
            transactionsCommitted: 0,
            transactionsRolledBack: 0,
            deadlocksDetected: 0,
            retriesPerformed: 0,
            timeouts: 0,
            depthInconsistencies: 0
        };
    }

    /**
     * Get current transaction depth
     * @returns {number}
     */
    getDepth() {
        return this.transactionDepth;
    }

    /**
     * Check if currently in a transaction
     * @returns {boolean}
     */
    isInTransaction() {
        return this.transactionDepth > 0 && this.activeTx !== null;
    }

    /**
     * Execute function in a managed transaction
     * @param {Function} fn - Async function accepting (txWrapper)
     * @param {Object} [options]
     * @returns {Promise<any>}
     */
    async execute(fn, options = {}) {
        // If already in a transaction, reuse the active transaction wrapper
        if (this.isInTransaction()) {
            this.transactionDepth++;
            try {
                return await fn(this.activeTxWrapper);
            } finally {
                this.transactionDepth--;
            }
        }

        if (!this.db || !this.db.db) {
            throw new DatabaseError('Database client not ready for transaction');
        }

        // Open native LibSQL transaction
        const tx = await this.db.db.transaction('write');
        this.activeTx = tx;
        this.transactionDepth = 1;
        this.stats.transactionsStarted++;

        const txWrapper = {
            query: async (sql, params = []) => {
                const res = await tx.execute({ sql, args: params });
                return res.rows ? Array.from(res.rows) : [];
            },
            queryOne: async (sql, params = []) => {
                const res = await tx.execute({ sql, args: params });
                return (res.rows && res.rows.length > 0) ? res.rows[0] : null;
            },
            execute: async (sql, params = []) => {
                return await tx.execute({ sql, args: params });
            },
            transaction: async (nestedFn) => {
                return await this.execute(nestedFn);
            }
        };

        this.activeTxWrapper = txWrapper;

        try {
            const result = await fn(txWrapper);
            await tx.commit();
            this.stats.transactionsCommitted++;
            return result;
        } catch (error) {
            try {
                await tx.rollback();
            } catch (rollbackErr) {
                // Ignore rollback errors if already aborted
            }
            this.stats.transactionsRolledBack++;
            throw error;
        } finally {
            this.activeTx = null;
            this.activeTxWrapper = null;
            this.transactionDepth = 0;
        }
    }

    /**
     * Check if error is a deadlock error
     * @param {Error} error
     * @returns {boolean}
     * @private
     */
    _isDeadlockError(error) {
        const message = error.message?.toLowerCase() || '';
        return message.includes('deadlock') ||
            message.includes('database is locked') ||
            message.includes('sqlite_busy');
    }

    /**
     * Handle deadlock with retry
     * @param {Function} fn
     * @param {Object} options
     * @returns {Promise<any>}
     */
    async withDeadlockRetry(fn, options = {}) {
        const maxRetries = options.maxRetries || this.options.maxRetries;
        const initialDelay = options.initialDelay || this.options.deadlockRetryDelay;

        return await retryWithBackoff(
            async () => {
                try {
                    return await fn();
                } catch (error) {
                    if (this._isDeadlockError(error)) {
                        this.stats.deadlocksDetected++;
                        this.transactionDepth = 0;
                        this.activeTx = null;
                        this.activeTxWrapper = null;
                    }
                    throw error;
                }
            },
            {
                maxRetries,
                initialDelay,
                maxDelay: this.options.maxDelay,
                backoffMultiplier: this.options.backoffMultiplier,
                shouldRetry: (error) => {
                    return this._isDeadlockError(error) || shouldRetryError(error);
                },
                onRetry: () => {
                    this.stats.retriesPerformed++;
                }
            }
        );
    }

    /**
     * Execute function with transaction and deadlock retry
     * @param {Function} fn
     * @param {Object} options
     * @returns {Promise<any>}
     */
    async executeWithRetry(fn, options = {}) {
        return await this.withDeadlockRetry(
            async () => {
                return await this.execute(fn, options);
            },
            options
        );
    }

    /**
     * Reset depth and state
     */
    async recoverDepth() {
        this.transactionDepth = 0;
        this.activeTx = null;
        this.activeTxWrapper = null;
    }

    /**
     * Get transaction statistics
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            currentDepth: this.transactionDepth,
            isInTransaction: this.isInTransaction()
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            transactionsStarted: 0,
            transactionsCommitted: 0,
            transactionsRolledBack: 0,
            deadlocksDetected: 0,
            retriesPerformed: 0,
            timeouts: 0,
            depthInconsistencies: 0
        };
    }
}

module.exports = TransactionManager;
