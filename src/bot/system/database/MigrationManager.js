/**
 * Migration Manager
 * 
 * Manages database schema migrations for Turso DB.
 * Handles migration execution, rollback, and status tracking.
 */

const fs = require('fs').promises;
const path = require('path');
const { DatabaseError } = require('../core/Errors');

class MigrationManager {
    /**
     * Create a new MigrationManager instance
     * @param {DatabaseLibrary} database - Database instance
     * @param {Object} options - Migration options
     */
    constructor(database, options = {}) {
        this.database = database;
        this.logger = database.logger || console;

        // Migration configuration
        this.config = {
            migrationsPath: options.migrationsPath || path.join(process.cwd(), 'src', 'bot', 'migrations'),
            tableName: options.tableName || 'migrations',
            ...options
        };

        this.currentBatch = 0;
    }

    /**
     * Initialize migrations table if it doesn't exist
     * @returns {Promise<void>}
     * @private
     */
    async _ensureMigrationsTable() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS ${this.config.tableName} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                batch INTEGER NOT NULL,
                executed_at INTEGER NOT NULL
            )
        `;

        const createIndexSQL = `
            CREATE INDEX IF NOT EXISTS idx_migrations_batch 
            ON ${this.config.tableName}(batch)
        `;

        try {
            await this.database.query(createTableSQL);
            await this.database.query(createIndexSQL);
            this.log('Migrations table initialized', 'debug');
        } catch (error) {
            throw new DatabaseError('Failed to create migrations table', {
                originalError: error.message
            });
        }
    }

    /**
     * Get all migration files from the migrations directory
     * @returns {Promise<Array<string>>} Array of migration file names
     * @private
     */
    async _getMigrationFiles() {
        try {
            // Ensure migrations directory exists
            try {
                await fs.access(this.config.migrationsPath);
            } catch {
                // Create directory if it doesn't exist
                await fs.mkdir(this.config.migrationsPath, { recursive: true });
                this.log(`Created migrations directory: ${this.config.migrationsPath}`, 'info');
                return [];
            }

            const files = await fs.readdir(this.config.migrationsPath);

            // Filter for .js files and sort them
            const migrationFiles = files
                .filter(file => file.endsWith('.js'))
                .sort();

            return migrationFiles;
        } catch (error) {
            throw new DatabaseError('Failed to read migration files', {
                originalError: error.message,
                path: this.config.migrationsPath
            });
        }
    }

    /**
     * Get executed migrations from database
     * @returns {Promise<Array<Object>>} Array of executed migration records
     * @private
     */
    async _getExecutedMigrations() {
        try {
            const sql = `
                SELECT name, batch, executed_at 
                FROM ${this.config.tableName} 
                ORDER BY id ASC
            `;

            const migrations = await this.database.query(sql);
            return migrations || [];
        } catch (error) {
            throw new DatabaseError('Failed to get executed migrations', {
                originalError: error.message
            });
        }
    }

    /**
     * Get pending migrations that haven't been executed
     * @returns {Promise<Array<string>>} Array of pending migration file names
     * @private
     */
    async _getPendingMigrations() {
        const allFiles = await this._getMigrationFiles();
        const executed = await this._getExecutedMigrations();
        const executedNames = new Set(executed.map(m => m.name));

        return allFiles.filter(file => !executedNames.has(file));
    }

    /**
     * Get the next batch number
     * @returns {Promise<number>} Next batch number
     * @private
     */
    async _getNextBatch() {
        try {
            const sql = `
                SELECT MAX(batch) as max_batch 
                FROM ${this.config.tableName}
            `;

            const result = await this.database.queryOne(sql);
            return (result?.max_batch || 0) + 1;
        } catch (error) {
            throw new DatabaseError('Failed to get next batch number', {
                originalError: error.message
            });
        }
    }

    /**
     * Record a migration as executed
     * @param {string} name - Migration file name
     * @param {number} batch - Batch number
     * @returns {Promise<void>}
     * @private
     */
    async _recordMigration(name, batch) {
        try {
            const sql = `
                INSERT INTO ${this.config.tableName} (name, batch, executed_at)
                VALUES (?, ?, ?)
            `;

            await this.database.query(sql, [name, batch, Date.now()]);
        } catch (error) {
            throw new DatabaseError('Failed to record migration', {
                originalError: error.message,
                migration: name,
                batch
            });
        }
    }

    /**
     * Remove a migration record
     * @param {string} name - Migration file name
     * @returns {Promise<void>}
     * @private
     */
    async _removeMigrationRecord(name) {
        try {
            const sql = `
                DELETE FROM ${this.config.tableName}
                WHERE name = ?
            `;

            await this.database.query(sql, [name]);
        } catch (error) {
            throw new DatabaseError('Failed to remove migration record', {
                originalError: error.message,
                migration: name
            });
        }
    }

    /**
     * Load and execute a migration file
     * @param {string} fileName - Migration file name
     * @param {string} direction - 'up' or 'down'
     * @returns {Promise<void>}
     * @private
     */
    async _executeMigrationFile(fileName, direction = 'up') {
        const filePath = path.join(this.config.migrationsPath, fileName);

        try {
            // Load migration module
            const migration = require(filePath);

            // Validate migration has required methods
            if (typeof migration[direction] !== 'function') {
                throw new Error(`Migration ${fileName} does not have ${direction}() method`);
            }

            // Execute migration within a transaction
            await this.database.transaction(async (db) => {
                await migration[direction](db);
            });

            this.log(`Migration ${direction}: ${fileName}`, 'info');
        } catch (error) {
            throw new DatabaseError(`Failed to execute migration ${direction}`, {
                originalError: error.message,
                migration: fileName,
                direction,
                filePath
            });
        }
    }

    /**
     * Run all pending migrations
     * @returns {Promise<Object>} Migration results
     */
    async runMigrations() {
        try {
            // Ensure migrations table exists
            await this._ensureMigrationsTable();

            // Get pending migrations
            const pending = await this._getPendingMigrations();

            if (pending.length === 0) {
                this.log('No pending migrations to run', 'info');
                return {
                    success: true,
                    executed: [],
                    message: 'No pending migrations'
                };
            }

            // Get next batch number
            const batch = await this._getNextBatch();
            this.currentBatch = batch;

            const executed = [];
            const failed = [];

            // Execute each pending migration
            for (const fileName of pending) {
                try {
                    this.log(`Running migration: ${fileName}`, 'info');

                    // Execute migration up
                    await this._executeMigrationFile(fileName, 'up');

                    // Record migration
                    await this._recordMigration(fileName, batch);

                    executed.push(fileName);
                    this.log(`Migration completed: ${fileName}`, 'info');
                } catch (error) {
                    this.log(`Migration failed: ${fileName} - ${error.message}`, 'error');
                    failed.push({
                        fileName,
                        error: error.message
                    });

                    // Stop on first failure
                    break;
                }
            }

            const success = failed.length === 0;

            return {
                success,
                executed,
                failed,
                batch,
                message: success
                    ? `Successfully executed ${executed.length} migration(s)`
                    : `Migration failed after ${executed.length} successful migration(s)`
            };
        } catch (error) {
            this.log(`Migration process failed: ${error.message}`, 'error');
            throw new DatabaseError('Migration process failed', {
                originalError: error.message
            });
        }
    }

    /**
     * Rollback migrations
     * @param {number} steps - Number of batches to rollback (default: 1)
     * @returns {Promise<Object>} Rollback results
     */
    async rollback(steps = 1) {
        try {
            // Ensure migrations table exists
            await this._ensureMigrationsTable();

            // Get executed migrations
            const executed = await this._getExecutedMigrations();

            if (executed.length === 0) {
                this.log('No migrations to rollback', 'info');
                return {
                    success: true,
                    rolledBack: [],
                    message: 'No migrations to rollback'
                };
            }

            // Get the batches to rollback
            const maxBatch = Math.max(...executed.map(m => m.batch));
            const minBatch = Math.max(1, maxBatch - steps + 1);

            // Get migrations to rollback (in reverse order)
            const toRollback = executed
                .filter(m => m.batch >= minBatch && m.batch <= maxBatch)
                .reverse();

            if (toRollback.length === 0) {
                this.log('No migrations in specified batches', 'info');
                return {
                    success: true,
                    rolledBack: [],
                    message: 'No migrations to rollback'
                };
            }

            const rolledBack = [];
            const failed = [];

            // Execute rollback for each migration
            for (const migration of toRollback) {
                try {
                    this.log(`Rolling back migration: ${migration.name}`, 'info');

                    // Execute migration down
                    await this._executeMigrationFile(migration.name, 'down');

                    // Remove migration record
                    await this._removeMigrationRecord(migration.name);

                    rolledBack.push(migration.name);
                    this.log(`Rollback completed: ${migration.name}`, 'info');
                } catch (error) {
                    this.log(`Rollback failed: ${migration.name} - ${error.message}`, 'error');
                    failed.push({
                        fileName: migration.name,
                        error: error.message
                    });

                    // Stop on first failure
                    break;
                }
            }

            const success = failed.length === 0;

            return {
                success,
                rolledBack,
                failed,
                batches: `${minBatch}-${maxBatch}`,
                message: success
                    ? `Successfully rolled back ${rolledBack.length} migration(s)`
                    : `Rollback failed after ${rolledBack.length} successful rollback(s)`
            };
        } catch (error) {
            this.log(`Rollback process failed: ${error.message}`, 'error');
            throw new DatabaseError('Rollback process failed', {
                originalError: error.message
            });
        }
    }

    /**
     * Get migration status
     * @returns {Promise<Object>} Migration status information
     */
    async getStatus() {
        try {
            // Ensure migrations table exists
            await this._ensureMigrationsTable();

            // Get all migration files
            const allFiles = await this._getMigrationFiles();

            // Get executed migrations
            const executed = await this._getExecutedMigrations();
            const executedNames = new Set(executed.map(m => m.name));

            // Separate pending and executed
            const pending = allFiles.filter(file => !executedNames.has(file));
            const executedList = allFiles.filter(file => executedNames.has(file));

            // Get batch information
            const batches = {};
            executed.forEach(m => {
                if (!batches[m.batch]) {
                    batches[m.batch] = [];
                }
                batches[m.batch].push(m.name);
            });

            return {
                total: allFiles.length,
                executed: executedList.length,
                pending: pending.length,
                executedMigrations: executedList,
                pendingMigrations: pending,
                batches,
                lastBatch: executed.length > 0 ? Math.max(...executed.map(m => m.batch)) : 0
            };
        } catch (error) {
            this.log(`Failed to get migration status: ${error.message}`, 'error');
            throw new DatabaseError('Failed to get migration status', {
                originalError: error.message
            });
        }
    }

    /**
     * Create a new migration file
     * @param {string} name - Migration name (will be prefixed with timestamp)
     * @returns {Promise<string>} Path to created migration file
     */
    async createMigration(name) {
        try {
            // Ensure migrations directory exists
            await fs.mkdir(this.config.migrationsPath, { recursive: true });

            // Generate timestamp prefix
            const timestamp = Date.now();
            const fileName = `${timestamp}_${name}.js`;
            const filePath = path.join(this.config.migrationsPath, fileName);

            // Migration template
            const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

/**
 * Run the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function up(db) {
    // Add your migration code here
    // Example:
    // await db.query(\`
    //     CREATE TABLE example (
    //         id TEXT PRIMARY KEY,
    //         name TEXT NOT NULL,
    //         created_at INTEGER NOT NULL
    //     )
    // \`);
}

/**
 * Reverse the migration
 * @param {DatabaseLibrary} db - Database instance
 * @returns {Promise<void>}
 */
async function down(db) {
    // Add your rollback code here
    // Example:
    // await db.query('DROP TABLE IF EXISTS example');
}

module.exports = { up, down };
`;

            // Write migration file
            await fs.writeFile(filePath, template, 'utf8');

            this.log(`Created migration: ${fileName}`, 'info');

            return filePath;
        } catch (error) {
            throw new DatabaseError('Failed to create migration file', {
                originalError: error.message,
                name
            });
        }
    }

    /**
     * Log message with MigrationManager context
     * @param {string} message - Log message
     * @param {string} level - Log level
     * @param {Object} metadata - Additional metadata
     */
    log(message, level = 'info', metadata = {}) {
        if (this.logger && typeof this.logger[level] === 'function') {
            if (Object.keys(metadata).length > 0) {
                this.logger[level](`[MigrationManager] ${message}`, metadata);
            } else {
                this.logger[level](`[MigrationManager] ${message}`);
            }
        }
    }
}

module.exports = MigrationManager;
