/**
 * Migration Runner Script
 * 
 * Runs all pending database migrations
 */

require('dotenv').config();
const { createClient } = require('@libsql/client');
const path = require('path');
const MigrationManager = require('../system/database/MigrationManager');
const logger = require('../system/helpers/logger_helper');

async function runMigrations() {
    try {
        // Validate environment
        if (!process.env.TURSO_DATABASE_URL) {
            console.error('❌ TURSO_DATABASE_URL is required');
            process.exit(1);
        }

        if (!process.env.TURSO_AUTH_TOKEN) {
            console.error('❌ TURSO_AUTH_TOKEN is required');
            process.exit(1);
        }

        // Create database connection
        const db = createClient({
            url: process.env.TURSO_DATABASE_URL,
            authToken: process.env.TURSO_AUTH_TOKEN,
        });

        // Create database wrapper for MigrationManager
        const databaseWrapper = {
            query: async (sql, params = []) => {
                const result = await db.execute({ sql, args: params });
                return result.rows || [];
            },
            execute: async (sql, params = []) => {
                const result = await db.execute({ sql, args: params });
                return {
                    changes: result.rowsAffected || 0,
                    lastInsertRowid: result.lastInsertRowid || null,
                };
            },
            queryOne: async (sql, params = []) => {
                const result = await db.execute({ sql, args: params });
                return result.rows?.[0] || null;
            },
            // Compatibility for migrations that use db.exec
            exec: async (sql) => {
                // Split by semicolon newlines to support multi-statement execs
                const statements = sql
                    .split(/;\s*\n/)
                    .map(s => s.trim())
                    .filter(Boolean);
                for (const stmt of statements) {
                    await db.execute(stmt);
                }
            },
            // Transaction wrapper (libsql http driver doesn't support BEGIN/COMMIT the same way)
            // We run migrations without wrapping in a transaction to avoid rollback issues.
            transaction: async (fn) => {
                return await fn(databaseWrapper);
            },
            logger: logger,
        };

        // Initialize migration manager
        const migrationManager = new MigrationManager(databaseWrapper, {
            migrationsPath: path.join(__dirname, '..', 'migrations'),
        });

        console.log('🔄 Running migrations...\n');

        // Run migrations
        const result = await migrationManager.runMigrations();

        if (result.success) {
            if (result.executed.length > 0) {
                console.log(`\n✅ Successfully executed ${result.executed.length} migration(s):`);
                result.executed.forEach((migration) => {
                    console.log(`   - ${migration}`);
                });
            } else {
                console.log('\n✅ No pending migrations');
            }
            process.exit(0);
        } else {
            console.error(`\n❌ Migration failed: ${result.failed[0]?.fileName}`);
            console.error(`   Error: ${result.failed[0]?.error}`);
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Failed to run migrations:', error.message);
        logger.error('Migration runner error', {
            error: error.message,
            stack: error.stack,
        });
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runMigrations();
}

module.exports = { runMigrations };
