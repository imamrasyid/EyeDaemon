/**
 * Model Base Class
 * 
 * Base class for all models in the application.
 * Provides database access and loader instance.
 * Inspired by CodeIgniter's Model pattern.
 * Updated for LibSQL async operations with Turso DB.
 */

const Loader = require('./Loader');
const { DatabaseError } = require('./Errors');

class Model {
    /**
     * Create a new Model instance
     * @param {Object} instance - The parent instance (usually a Controller)
     */
    constructor(instance) {
        this.instance = instance;

        // Access to database through client (LibSQL Database library)
        if (instance.client && instance.client.database) {
            this.db = instance.client.database;
        } else if (instance.db) {
            this.db = instance.db;
        } else {
            this.db = null;
        }

        // Initialize loader for dynamic loading of other models, libraries, and helpers
        this.load = new Loader(this);

        // Table name (to be overridden by child classes)
        this.tableName = null;

        // Primary key column name (can be overridden by child classes)
        this.primaryKey = 'id';
    }

    /**
     * Get database connection
     * @returns {Object|null} Database connection (LibSQL Database library)
     */
    getDatabase() {
        return this.db;
    }

    /**
     * Execute a database query with retry logic
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<Array|Object>} Query results
     */
    async query(sql, params = []) {
        if (!this.db) {
            throw new DatabaseError('Database connection not available');
        }

        if (!this.db.isReady()) {
            throw new DatabaseError('Database is not ready');
        }

        try {
            // Database library already has retry logic built-in
            return await this.db.query(sql, params);
        } catch (error) {
            this.log(`Query error: ${error.message}`, 'error');
            throw new DatabaseError(error.message, { sql, params });
        }
    }

    /**
     * Execute a query and return the first row
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<Object|null>} First row or null
     */
    async queryOne(sql, params = []) {
        if (!this.db) {
            throw new DatabaseError('Database connection not available');
        }

        try {
            return await this.db.queryOne(sql, params);
        } catch (error) {
            this.log(`Query error: ${error.message}`, 'error');
            throw new DatabaseError(error.message, { sql, params });
        }
    }

    /**
     * Find a single record by ID
     * @param {string|number} id - Record ID
     * @param {string} idColumn - ID column name (default: uses this.primaryKey)
     * @returns {Promise<Object|null>} Record or null
     */
    async findById(id, idColumn = null) {
        if (!this.tableName) {
            throw new DatabaseError('Table name not set in model');
        }

        const column = idColumn || this.primaryKey;
        const sql = `SELECT * FROM ${this.tableName} WHERE ${column} = ? LIMIT 1`;

        return await this.queryOne(sql, [id]);
    }

    /**
     * Find all records
     * @param {Object} options - Query options (limit, offset, orderBy, where)
     * @returns {Promise<Array>} Records
     */
    async findAll(options = {}) {
        if (!this.tableName) {
            throw new DatabaseError('Table name not set in model');
        }

        let sql = `SELECT * FROM ${this.tableName}`;
        const params = [];

        // Add WHERE clause if provided
        if (options.where) {
            const conditions = [];
            for (const [key, value] of Object.entries(options.where)) {
                conditions.push(`${key} = ?`);
                params.push(value);
            }
            if (conditions.length > 0) {
                sql += ` WHERE ${conditions.join(' AND ')}`;
            }
        }

        // Add ORDER BY clause
        if (options.orderBy) {
            sql += ` ORDER BY ${options.orderBy}`;
        }

        // Add LIMIT clause
        if (options.limit) {
            sql += ` LIMIT ?`;
            params.push(options.limit);
        }

        // Add OFFSET clause
        if (options.offset) {
            sql += ` OFFSET ?`;
            params.push(options.offset);
        }

        return await this.query(sql, params);
    }

    /**
     * Find records by criteria
     * @param {Object} criteria - Search criteria (key-value pairs)
     * @param {Object} options - Query options (orderBy, limit, offset)
     * @returns {Promise<Array>} Records
     */
    async findBy(criteria, options = {}) {
        if (!this.tableName) {
            throw new DatabaseError('Table name not set in model');
        }

        if (!criteria || Object.keys(criteria).length === 0) {
            throw new DatabaseError('Search criteria cannot be empty');
        }

        const conditions = [];
        const params = [];

        for (const [key, value] of Object.entries(criteria)) {
            conditions.push(`${key} = ?`);
            params.push(value);
        }

        let sql = `SELECT * FROM ${this.tableName} WHERE ${conditions.join(' AND ')}`;

        if (options.orderBy) {
            sql += ` ORDER BY ${options.orderBy}`;
        }

        if (options.limit) {
            sql += ` LIMIT ?`;
            params.push(options.limit);
        }

        if (options.offset) {
            sql += ` OFFSET ?`;
            params.push(options.offset);
        }

        return await this.query(sql, params);
    }

    /**
     * Find a single record by criteria
     * @param {Object} criteria - Search criteria (key-value pairs)
     * @returns {Promise<Object|null>} Record or null
     */
    async findOneBy(criteria) {
        if (!this.tableName) {
            throw new DatabaseError('Table name not set in model');
        }

        if (!criteria || Object.keys(criteria).length === 0) {
            throw new DatabaseError('Search criteria cannot be empty');
        }

        const conditions = [];
        const params = [];

        for (const [key, value] of Object.entries(criteria)) {
            conditions.push(`${key} = ?`);
            params.push(value);
        }

        const sql = `SELECT * FROM ${this.tableName} WHERE ${conditions.join(' AND ')} LIMIT 1`;

        return await this.queryOne(sql, params);
    }

    /**
     * Insert a new record
     * @param {Object} data - Data to insert
     * @returns {Promise<Object>} Insert result with lastInsertRowid and changes
     */
    async insert(data) {
        if (!this.tableName) {
            throw new DatabaseError('Table name not set in model');
        }

        if (!data || Object.keys(data).length === 0) {
            throw new DatabaseError('Insert data cannot be empty');
        }

        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map(() => '?').join(', ');

        const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

        return await this.query(sql, values);
    }

    /**
     * Update a record by ID
     * @param {string|number} id - Record ID
     * @param {Object} data - Data to update
     * @param {string} idColumn - ID column name (default: uses this.primaryKey)
     * @returns {Promise<Object>} Update result with changes count
     */
    async update(id, data, idColumn = null) {
        if (!this.tableName) {
            throw new DatabaseError('Table name not set in model');
        }

        if (!data || Object.keys(data).length === 0) {
            throw new DatabaseError('Update data cannot be empty');
        }

        const column = idColumn || this.primaryKey;
        const columns = Object.keys(data);
        const values = Object.values(data);
        const setClause = columns.map(col => `${col} = ?`).join(', ');

        const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${column} = ?`;
        values.push(id);

        return await this.query(sql, values);
    }

    /**
     * Update records by criteria
     * @param {Object} criteria - Search criteria (key-value pairs)
     * @param {Object} data - Data to update
     * @returns {Promise<Object>} Update result with changes count
     */
    async updateBy(criteria, data) {
        if (!this.tableName) {
            throw new DatabaseError('Table name not set in model');
        }

        if (!criteria || Object.keys(criteria).length === 0) {
            throw new DatabaseError('Update criteria cannot be empty');
        }

        if (!data || Object.keys(data).length === 0) {
            throw new DatabaseError('Update data cannot be empty');
        }

        const setColumns = Object.keys(data);
        const setValues = Object.values(data);
        const setClause = setColumns.map(col => `${col} = ?`).join(', ');

        const whereConditions = [];
        const whereValues = [];
        for (const [key, value] of Object.entries(criteria)) {
            whereConditions.push(`${key} = ?`);
            whereValues.push(value);
        }

        const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${whereConditions.join(' AND ')}`;
        const params = [...setValues, ...whereValues];

        return await this.query(sql, params);
    }

    /**
     * Delete a record by ID
     * @param {string|number} id - Record ID
     * @param {string} idColumn - ID column name (default: uses this.primaryKey)
     * @returns {Promise<Object>} Delete result with changes count
     */
    async delete(id, idColumn = null) {
        if (!this.tableName) {
            throw new DatabaseError('Table name not set in model');
        }

        const column = idColumn || this.primaryKey;
        const sql = `DELETE FROM ${this.tableName} WHERE ${column} = ?`;

        return await this.query(sql, [id]);
    }

    /**
     * Delete records by criteria
     * @param {Object} criteria - Search criteria (key-value pairs)
     * @returns {Promise<Object>} Delete result with changes count
     */
    async deleteBy(criteria) {
        if (!this.tableName) {
            throw new DatabaseError('Table name not set in model');
        }

        if (!criteria || Object.keys(criteria).length === 0) {
            throw new DatabaseError('Delete criteria cannot be empty');
        }

        const conditions = [];
        const params = [];

        for (const [key, value] of Object.entries(criteria)) {
            conditions.push(`${key} = ?`);
            params.push(value);
        }

        const sql = `DELETE FROM ${this.tableName} WHERE ${conditions.join(' AND ')}`;

        return await this.query(sql, params);
    }

    /**
     * Insert or update a record (upsert)
     * @param {Object} data - Data to insert or update
     * @param {Array<string>} conflictColumns - Columns to check for conflicts
     * @returns {Promise<Object>} Upsert result
     */
    async upsert(data, conflictColumns) {
        if (!this.tableName) {
            throw new DatabaseError('Table name not set in model');
        }

        if (!data || Object.keys(data).length === 0) {
            throw new DatabaseError('Upsert data cannot be empty');
        }

        if (!Array.isArray(conflictColumns) || conflictColumns.length === 0) {
            throw new DatabaseError('Conflict columns must be specified for upsert');
        }

        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map(() => '?').join(', ');

        // Build UPDATE clause for conflict resolution
        const updateColumns = columns.filter(col => !conflictColumns.includes(col));
        const updateClause = updateColumns.map(col => `${col} = excluded.${col}`).join(', ');

        const sql = `
            INSERT INTO ${this.tableName} (${columns.join(', ')})
            VALUES (${placeholders})
            ON CONFLICT(${conflictColumns.join(', ')})
            DO UPDATE SET ${updateClause}
        `;

        return await this.query(sql, values);
    }

    /**
     * Get paginated results
     * @param {number} page - Page number (1-based)
     * @param {number} perPage - Records per page
     * @param {Object} options - Query options (where, orderBy)
     * @returns {Promise<Object>} Paginated results with metadata
     */
    async paginate(page = 1, perPage = 10, options = {}) {
        if (!this.tableName) {
            throw new DatabaseError('Table name not set in model');
        }

        if (page < 1) {
            throw new DatabaseError('Page number must be >= 1');
        }

        if (perPage < 1) {
            throw new DatabaseError('Per page must be >= 1');
        }

        // Build WHERE clause
        let whereClause = '';
        const params = [];

        if (options.where) {
            const conditions = [];
            for (const [key, value] of Object.entries(options.where)) {
                conditions.push(`${key} = ?`);
                params.push(value);
            }
            if (conditions.length > 0) {
                whereClause = ` WHERE ${conditions.join(' AND ')}`;
            }
        }

        // Get total count
        const countSql = `SELECT COUNT(*) as total FROM ${this.tableName}${whereClause}`;
        const countResult = await this.queryOne(countSql, params);
        const total = countResult.total || 0;

        // Calculate pagination metadata
        const totalPages = Math.ceil(total / perPage);
        const offset = (page - 1) * perPage;

        // Build data query
        let dataSql = `SELECT * FROM ${this.tableName}${whereClause}`;

        if (options.orderBy) {
            dataSql += ` ORDER BY ${options.orderBy}`;
        }

        dataSql += ` LIMIT ? OFFSET ?`;
        const dataParams = [...params, perPage, offset];

        const data = await this.query(dataSql, dataParams);

        return {
            data,
            pagination: {
                page,
                perPage,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        };
    }

    /**
     * Count records matching criteria
     * @param {Object} criteria - Search criteria (key-value pairs)
     * @returns {Promise<number>} Count of matching records
     */
    async count(criteria = {}) {
        if (!this.tableName) {
            throw new DatabaseError('Table name not set in model');
        }

        let sql = `SELECT COUNT(*) as total FROM ${this.tableName}`;
        const params = [];

        if (criteria && Object.keys(criteria).length > 0) {
            const conditions = [];
            for (const [key, value] of Object.entries(criteria)) {
                conditions.push(`${key} = ?`);
                params.push(value);
            }
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }

        const result = await this.queryOne(sql, params);
        return result.total || 0;
    }

    /**
     * Check if a record exists matching criteria
     * @param {Object} criteria - Search criteria (key-value pairs)
     * @returns {Promise<boolean>} True if record exists
     */
    async exists(criteria) {
        if (!this.tableName) {
            throw new DatabaseError('Table name not set in model');
        }

        if (!criteria || Object.keys(criteria).length === 0) {
            throw new DatabaseError('Exists criteria cannot be empty');
        }

        const count = await this.count(criteria);
        return count > 0;
    }

    /**
     * Batch insert multiple records in a transaction
     * @param {Array<Object>} dataArray - Array of data objects to insert
     * @returns {Promise<Object>} Result with total changes and inserted IDs
     */
    async batchInsert(dataArray) {
        if (!this.tableName) {
            throw new DatabaseError('Table name not set in model');
        }

        if (!Array.isArray(dataArray) || dataArray.length === 0) {
            throw new DatabaseError('Batch insert requires non-empty array');
        }

        // Use transaction for atomicity
        return await this.db.transaction(async (db) => {
            const results = [];
            let totalChanges = 0;

            for (const data of dataArray) {
                const columns = Object.keys(data);
                const values = Object.values(data);
                const placeholders = columns.map(() => '?').join(', ');

                const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
                const result = await db.query(sql, values);

                results.push({
                    lastInsertRowid: result.lastInsertRowid,
                    changes: result.changes
                });
                totalChanges += result.changes || 0;
            }

            return {
                totalChanges,
                results,
                insertedCount: results.length
            };
        });
    }

    /**
     * Batch update multiple records in a transaction
     * @param {Array<Object>} updates - Array of {id, data, idColumn} objects
     * @returns {Promise<Object>} Result with total changes
     */
    async batchUpdate(updates) {
        if (!this.tableName) {
            throw new DatabaseError('Table name not set in model');
        }

        if (!Array.isArray(updates) || updates.length === 0) {
            throw new DatabaseError('Batch update requires non-empty array');
        }

        // Use transaction for atomicity
        return await this.db.transaction(async (db) => {
            let totalChanges = 0;

            for (const update of updates) {
                const { id, data, idColumn } = update;

                if (!id || !data || Object.keys(data).length === 0) {
                    throw new DatabaseError('Each update must have id and data');
                }

                const column = idColumn || this.primaryKey;
                const columns = Object.keys(data);
                const values = Object.values(data);
                const setClause = columns.map(col => `${col} = ?`).join(', ');

                const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${column} = ?`;
                values.push(id);

                const result = await db.query(sql, values);
                totalChanges += result.changes || 0;
            }

            return {
                totalChanges,
                updatedCount: updates.length
            };
        });
    }

    /**
     * Batch delete multiple records by IDs in a transaction
     * @param {Array<string|number>} ids - Array of record IDs to delete
     * @param {string} idColumn - ID column name (default: uses this.primaryKey)
     * @returns {Promise<Object>} Result with total changes
     */
    async batchDelete(ids, idColumn = null) {
        if (!this.tableName) {
            throw new DatabaseError('Table name not set in model');
        }

        if (!Array.isArray(ids) || ids.length === 0) {
            throw new DatabaseError('Batch delete requires non-empty array of IDs');
        }

        const column = idColumn || this.primaryKey;

        // Use IN clause for efficient batch delete
        const placeholders = ids.map(() => '?').join(', ');
        const sql = `DELETE FROM ${this.tableName} WHERE ${column} IN (${placeholders})`;

        const result = await this.query(sql, ids);

        return {
            totalChanges: result.changes || 0,
            deletedCount: result.changes || 0
        };
    }

    /**
     * Log message with model context
     * @param {string} message - Message to log
     * @param {string} level - Log level (info, warn, error)
     */
    log(message, level = 'info') {
        const prefix = `[${this.constructor.name}]`;

        if (this.instance.client && this.instance.client.logger) {
            this.instance.client.logger[level](`${prefix} ${message}`);
        } else {
            console[level](`${prefix} ${message}`);
        }
    }
}

module.exports = Model;
