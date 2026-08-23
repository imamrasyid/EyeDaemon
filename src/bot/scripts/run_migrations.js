'use strict';

/**
 * Migration Runner Script
 * 
 * Runs all pending database migrations against local SQLite or Turso DB.
 */

require('dotenv').config();
const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');
const MigrationManager = require('../system/database/MigrationManager');
const logger = require('../system/helpers/LoggerHelper');

async function runMigrations() {
    try {
        const dbUrl = process.env.TURSO_DATABASE_URL || 'file:./data/eyedaemon.db';
        const isLocalFile = dbUrl.startsWith('file:') || dbUrl === ':memory:';

        if (isLocalFile && dbUrl.startsWith('file:')) {
            const filePath = dbUrl.replace(/^file:/, '');
            const dir = path.dirname(path.resolve(filePath));
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }

        if (!isLocalFile && !process.env.TURSO_AUTH_TOKEN) {
            console.error('❌ TURSO_AUTH_TOKEN is required for remote database connections');
            process.exit(1);
        }

        const clientConfig = { url: dbUrl };
        if (process.env.TURSO_AUTH_TOKEN) {
            clientConfig.authToken = process.env.TURSO_AUTH_TOKEN;
        }

        const db = createClient(clientConfig);

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
            exec: async (sql) => {
                const statements = sql
                    .split(/;\s*\n/)
                    .map(s => s.trim())
                    .filter(Boolean);
                for (const stmt of statements) {
                    await db.execute(stmt);
                }
            },
            transaction: async (fn) => {
                return await fn(databaseWrapper);
            },
            logger: logger,
        };

        const migrationManager = new MigrationManager(databaseWrapper, {
            migrationsPath: path.join(__dirname, '..', 'migrations'),
        });

        console.log(`🔄 Running migrations for target [${dbUrl}]...\n`);

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

if (require.main === module) {
    runMigrations();
}

module.exports = { runMigrations };
