/**
 * TransactionManager Class
 * 
 * Manages database transactions dengan proper nesting support menggunakan savepoints.
 * Provides deadlock detection, retry logic, dan transaction timeout handling.
 */

const { DatabaseError } = require('../core/Errors');
const { retryWithBackoff, shouldRetryError } = require('../helpers/retry_helper');

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
            defaultTimeout: options.defaultTimeout || 30000, // 30 seconds
            deadlockRetryDelay: options.deadlockRetryDelay || 50,
            ...options
        };

        this.transactionDepth = 0;
        this.transactionStack = [];
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
     * @returns {number} Transaction depth
     */
    getDepth() {
        return this.transactionDepth;
    }

    /**
     * Check if in transaction
     * @returns {boolean} True if in transaction
     */
    isInTransaction() {
        return this.transactionDepth > 0;
    }

    /**
     * Begin a transaction or savepoint
     * @param {Object} options - Transaction options
     * @returns {Promise<void>}
     */
    async begin(options = {}) {
        try {
            const startTime = Date.now();
            const timeout = options.timeout || this.options.defaultTimeout;

            // Support nested transactions with savepoints
            if (this.transactionDepth > 0) {
                await this.db.query(`SAVEPOINT sp_${this.transactionDepth}`);
                this.transactionStack.push({
                    type: 'savepoint',
                    name: `sp_${this.transactionDepth}`,
                    startTime,
                    timeout
                });
            } else {
                await this.db.query('BEGIN TRANSACTION');
                this.transactionStack.push({
                    type: 'transaction',
                    startTime,
                    timeout
                });
            }

            this.transactionDepth++;
            this.stats.transactionsStarted++;
        } catch (error) {
            throw new DatabaseError('Failed to begin transaction', {
                originalError: error.message,
                transactionDepth: this.transactionDepth
            });
        }
    }

    /**
     * Commit a transaction or release savepoint
     * @returns {Promise<void>}
     */
    async commit() {
        if (this.transactionDepth === 0) {
            throw new DatabaseError('No active transaction to commit', {
                transactionDepth: this.transactionDepth
            });
        }

        const transaction = this.transactionStack[this.transactionStack.length - 1];

        // Check for timeout before committing
        if (transaction) {
            const elapsed = Date.now() - transaction.startTime;
            if (elapsed > transaction.timeout) {
                this.stats.timeouts++;
                // Rollback on timeout
                await this.rollback();
                throw new DatabaseError('Transaction timeout', {
                    elapsed,
                    timeout: transaction.timeout
                });
            }
        }

        try {
            this.transactionDepth--;
            this.transactionStack.pop();

            // Release savepoint for nested transactions, commit for top-level
            if (this.transactionDepth > 0) {
                await this.db.query(`RELEASE SAVEPOINT sp_${this.transactionDepth}`);
            } else {
                await this.db.query('COMMIT');
            }

            this.stats.transactionsCommitted++;
        } catch (error) {
            throw new DatabaseError('Failed to commit transaction', {
                originalError: error.message,
                transactionDepth: this.transactionDepth
            });
        }
    }

    /**
     * Rollback a transaction or savepoint
     * @returns {Promise<void>}
     */
    async rollback() {
        if (this.transactionDepth === 0) {
            throw new DatabaseError('No active transaction to rollback', {
                transactionDepth: this.transactionDepth
            });
        }

        try {
            this.transactionDepth--;
            this.transactionStack.pop();

            // Rollback to savepoint for nested transactions, rollback all for top-level
            if (this.transactionDepth > 0) {
                await this.db.query(`ROLLBACK TO SAVEPOINT sp_${this.transactionDepth}`);
            } else {
                await this.db.query('ROLLBACK');
            }

            this.stats.transactionsRolledBack++;
        } catch (error) {
            // Reset transaction depth on rollback error to prevent inconsistency
            this.transactionDepth = 0;
            this.transactionStack = [];
            this.stats.depthInconsistencies++;

            throw new DatabaseError('Failed to rollback transaction', {
                originalError: error.message,
                transactionDepth: this.transactionDepth
            });
        }
    }

    /**
     * Execute function in transaction with automatic commit/rollback
     * @param {Function} fn - Function to execute
     * @param {Object} options - Transaction options
     * @returns {Promise<any>} Function result
     */
    async execute(fn, options = {}) {
        await this.begin(options);

        try {
            const result = await fn(this);
            await this.commit();
            return result;
        } catch (error) {
            await this.rollback();
            throw error;
        }
    }

    /**
     * Check if error is a deadlock error
     * @param {Error} error - Error to check
     * @returns {boolean} True if deadlock
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
     * @param {Function} fn - Function to retry
     * @param {Object} options - Retry options
     * @returns {Promise<any>} Function result
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
                        // Reset transaction depth on deadlock
                        this.transactionDepth = 0;
                        this.transactionStack = [];
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
                onRetry: (error, attempt) => {
                    this.stats.retriesPerformed++;
                }
            }
        );
    }

    /**
     * Execute function with transaction and deadlock retry
     * @param {Function} fn - Function to execute
     * @param {Object} options - Options
     * @returns {Promise<any>} Function result
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
     * Detect and recover from transaction depth inconsistency
     * @returns {Promise<void>}
     */
    async recoverDepth() {
        try {
            // Try to rollback any pending transactions
            while (this.transactionDepth > 0) {
                try {
                    await this.rollback();
                } catch (error) {
                    // If rollback fails, force reset
                    break;
                }
            }

            // Force reset depth
            this.transactionDepth = 0;
            this.transactionStack = [];
            this.stats.depthInconsistencies++;
        } catch (error) {
            // Last resort: force reset
            this.transactionDepth = 0;
            this.transactionStack = [];
            throw new DatabaseError('Failed to recover transaction depth', {
                originalError: error.message
            });
        }
    }

    /**
     * Validate transaction depth consistency
     * @returns {boolean} True if consistent
     */
    validateDepth() {
        return this.transactionDepth === this.transactionStack.length &&
            this.transactionDepth >= 0;
    }

    /**
     * Get transaction statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            ...this.stats,
            currentDepth: this.transactionDepth,
            stackSize: this.transactionStack.length,
            isConsistent: this.validateDepth()
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

    /**
     * Get current transaction info
     * @returns {Object|null} Transaction info
     */
    getCurrentTransaction() {
        if (this.transactionStack.length === 0) {
            return null;
        }
        return this.transactionStack[this.transactionStack.length - 1];
    }

    /**
     * Get all active transactions
     * @returns {Array} Transaction stack
     */
    getTransactionStack() {
        return [...this.transactionStack];
    }
}

module.exports = TransactionManager;
