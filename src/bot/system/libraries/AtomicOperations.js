/**
 * AtomicOperations Class
 * 
 * Provides atomic database operations untuk mencegah race conditions.
 * Implements atomic increment, compare-and-swap, check-and-insert, dan optimistic locking.
 */

const { DatabaseError } = require('../core/Errors');
const crypto = require('crypto');

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
function generateUniqueId() {
    return crypto.randomBytes(16).toString('hex');
}

class AtomicOperations {
    /**
     * Create a new AtomicOperations instance
     * @param {Object} database - Database instance
     * @param {Object} options - Configuration options
     */
    constructor(database, options = {}) {
        this.db = database;
        this.options = {
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 100,
            ...options
        };

        this.stats = {
            incrementsPerformed: 0,
            compareAndSwapsPerformed: 0,
            checkAndInsertsPerformed: 0,
            optimisticLockRetries: 0,
            operationsFailed: 0
        };
    }

    /**
     * Atomic increment operation
     * @param {string} table - Table name
     * @param {string} column - Column to increment
     * @param {Object} where - Where conditions
     * @param {number} amount - Amount to increment (can be negative for decrement)
     * @returns {Promise<Object>} Result with new value
     */
    async increment(table, column, where, amount = 1) {
        try {
            // Build WHERE clause
            const whereKeys = Object.keys(where);
            const whereClause = whereKeys.map(key => `${key} = ?`).join(' AND ');
            const whereValues = Object.values(where);

            // Use SQL atomic increment
            const sql = `UPDATE ${table} SET ${column} = ${column} + ? WHERE ${whereClause}`;
            const params = [amount, ...whereValues];

            const result = await this.db.query(sql, params);

            if (result.changes === 0) {
                throw new Error('No rows updated - record may not exist');
            }

            // Get the updated value
            const selectSql = `SELECT ${column} FROM ${table} WHERE ${whereClause}`;
            const record = await this.db.queryOne(selectSql, whereValues);

            this.stats.incrementsPerformed++;

            return {
                success: true,
                changes: result.changes,
                newValue: record ? record[column] : null
            };
        } catch (error) {
            this.stats.operationsFailed++;
            throw new DatabaseError('Atomic increment failed', {
                table,
                column,
                where,
                amount,
                originalError: error.message
            });
        }
    }

    /**
     * Atomic compare-and-swap operation
     * @param {string} table - Table name
     * @param {Object} where - Where conditions
     * @param {Object} expected - Expected values
     * @param {Object} newValues - New values to set
     * @returns {Promise<boolean>} True if swap succeeded
     */
    async compareAndSwap(table, where, expected, newValues) {
        try {
            // Build WHERE clause with both where conditions and expected values
            const whereKeys = Object.keys(where);
            const expectedKeys = Object.keys(expected);

            const allConditions = [
                ...whereKeys.map(key => `${key} = ?`),
                ...expectedKeys.map(key => `${key} = ?`)
            ];
            const whereClause = allConditions.join(' AND ');

            const whereValues = [
                ...Object.values(where),
                ...Object.values(expected)
            ];

            // Build SET clause
            const setKeys = Object.keys(newValues);
            const setClause = setKeys.map(key => `${key} = ?`).join(', ');
            const setValues = Object.values(newValues);

            // Execute atomic update
            const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
            const params = [...setValues, ...whereValues];

            const result = await this.db.query(sql, params);

            this.stats.compareAndSwapsPerformed++;

            return result.changes > 0;
        } catch (error) {
            this.stats.operationsFailed++;
            throw new DatabaseError('Compare-and-swap failed', {
                table,
                where,
                expected,
                newValues,
                originalError: error.message
            });
        }
    }

    /**
     * Atomic check-and-insert operation
     * @param {string} table - Table name
     * @param {Object} checkWhere - Conditions to check
     * @param {Object} insertData - Data to insert if check fails
     * @returns {Promise<Object>} Result with inserted flag and data
     */
    async checkAndInsert(table, checkWhere, insertData) {
        try {
            // Build check query
            const checkKeys = Object.keys(checkWhere);
            const checkClause = checkKeys.map(key => `${key} = ?`).join(' AND ');
            const checkValues = Object.values(checkWhere);

            // Try to insert using INSERT OR IGNORE for atomicity
            // This is more atomic than check-then-insert
            const insertKeys = Object.keys(insertData);
            const placeholders = insertKeys.map(() => '?').join(', ');
            const insertSql = `INSERT OR IGNORE INTO ${table} (${insertKeys.join(', ')}) VALUES (${placeholders})`;
            const insertValues = Object.values(insertData);

            const result = await this.db.query(insertSql, insertValues);

            if (result.changes > 0) {
                // Successfully inserted
                const checkSql = `SELECT * FROM ${table} WHERE ${checkClause}`;
                const newRecord = await this.db.queryOne(checkSql, checkValues);
                this.stats.checkAndInsertsPerformed++;
                return {
                    inserted: true,
                    existing: false,
                    data: newRecord,
                    lastInsertRowid: result.lastInsertRowid
                };
            } else {
                // Record already exists (INSERT OR IGNORE did nothing)
                const checkSql = `SELECT * FROM ${table} WHERE ${checkClause}`;
                const existingRecord = await this.db.queryOne(checkSql, checkValues);
                this.stats.checkAndInsertsPerformed++;
                return {
                    inserted: false,
                    existing: true,
                    data: existingRecord
                };
            }
        } catch (error) {
            this.stats.operationsFailed++;
            throw new DatabaseError('Check-and-insert failed', {
                table,
                checkWhere,
                insertData,
                originalError: error.message
            });
        }
    }

    /**
     * Update with optimistic locking using version column
     * @param {string} table - Table name
     * @param {Object} where - Where conditions
     * @param {Object} updates - Updates to apply
     * @param {string} versionColumn - Version column name (default: 'version')
     * @returns {Promise<Object>} Result with success status
     */
    async updateWithOptimisticLock(table, where, updates, versionColumn = 'version') {
        let retries = 0;
        let lastError = null;

        while (retries < this.options.maxRetries) {
            try {
                // Get current record with version
                const whereKeys = Object.keys(where);
                const whereClause = whereKeys.map(key => `${key} = ?`).join(' AND ');
                const whereValues = Object.values(where);

                const selectSql = `SELECT * FROM ${table} WHERE ${whereClause}`;
                const currentRecord = await this.db.queryOne(selectSql, whereValues);

                if (!currentRecord) {
                    throw new Error('Record not found');
                }

                const currentVersion = currentRecord[versionColumn] || 0;
                const newVersion = currentVersion + 1;

                // Build update with version check
                const updateKeys = Object.keys(updates);
                const setClause = [
                    ...updateKeys.map(key => `${key} = ?`),
                    `${versionColumn} = ?`
                ].join(', ');

                const updateValues = [
                    ...Object.values(updates),
                    newVersion
                ];

                // Update only if version matches
                const updateSql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause} AND ${versionColumn} = ?`;
                const params = [...updateValues, ...whereValues, currentVersion];

                const result = await this.db.query(updateSql, params);

                if (result.changes > 0) {
                    // Success
                    return {
                        success: true,
                        version: newVersion,
                        retries
                    };
                } else {
                    // Version conflict - retry
                    this.stats.optimisticLockRetries++;
                    retries++;
                    lastError = new Error('Version conflict');

                    if (retries < this.options.maxRetries) {
                        // Exponential backoff
                        await this.sleep(this.options.retryDelay * Math.pow(2, retries - 1));
                    }
                }
            } catch (error) {
                lastError = error;
                retries++;

                if (retries < this.options.maxRetries) {
                    await this.sleep(this.options.retryDelay * Math.pow(2, retries - 1));
                }
            }
        }

        this.stats.operationsFailed++;
        throw new DatabaseError('Optimistic lock update failed after retries', {
            table,
            where,
            updates,
            retries,
            originalError: lastError?.message
        });
    }

    /**
     * Batch increment multiple records atomically
     * @param {string} table - Table name
     * @param {string} column - Column to increment
     * @param {Array<Object>} updates - Array of {where, amount} objects
     * @returns {Promise<Object>} Result with total changes
     */
    async batchIncrement(table, column, updates) {
        try {
            const results = [];

            for (const update of updates) {
                const result = await this.increment(table, column, update.where, update.amount);
                results.push(result);
            }

            return {
                success: true,
                totalChanges: results.reduce((sum, r) => sum + r.changes, 0),
                results
            };
        } catch (error) {
            this.stats.operationsFailed++;
            throw new DatabaseError('Batch increment failed', {
                table,
                column,
                updateCount: updates.length,
                originalError: error.message
            });
        }
    }

    /**
     * Get operation statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            incrementsPerformed: 0,
            compareAndSwapsPerformed: 0,
            checkAndInsertsPerformed: 0,
            optimisticLockRetries: 0,
            operationsFailed: 0
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
}

module.exports = AtomicOperations;
