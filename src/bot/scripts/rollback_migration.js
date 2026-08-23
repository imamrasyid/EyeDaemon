'use strict';

/**
 * Migration Rollback Script
 * 
 * Rolls back the most recent migration batch.
 */

require('dotenv').config();
const { createLibsqlClient } = require('../system/helpers/LibsqlHelper');
const path = require('path');
const fs = require('fs');
const MigrationManager = require('../system/database/MigrationManager');
const logger = require('../system/helpers/LoggerHelper');

async function rollbackMigration() {
    try {
        const dbUrl = process.env.TURSO_DATABASE_URL || 'file:./data/eyedaemon.db';
        const isLocalFile = dbUrl.startsWith('file:') || dbUrl === ':memory:';

        if (!isLocalFile && !process.env.TURSO_AUTH_TOKEN) {
            console.error('❌ TURSO_AUTH_TOKEN is required for remote database connections');
            process.exit(1);
        }

        const clientConfig = { url: dbUrl };
        if (process.env.TURSO_AUTH_TOKEN) {
            clientConfig.authToken = process.env.TURSO_AUTH_TOKEN;
        }

        const db = createLibsqlClient(clientConfig);

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

        console.log(`🔄 Rolling back migrations for [${dbUrl}]...\n`);

        const result = await migrationManager.rollback(1);

        if (result.success) {
            if (result.rolledBack.length > 0) {
                console.log(`\n✅ Successfully rolled back ${result.rolledBack.length} migration(s):`);
                result.rolledBack.forEach((migration) => {
                    console.log(`   - ${migration}`);
                });
            } else {
                console.log('\n✅ No migrations to roll back');
            }
            process.exit(0);
        } else {
            console.error(`\n❌ Rollback failed: ${result.failed[0]?.fileName}`);
            console.error(`   Error: ${result.failed[0]?.error}`);
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Failed to rollback migrations:', error.message);
        logger.error('Rollback runner error', {
            error: error.message,
            stack: error.stack,
        });
        process.exit(1);
    }
}

if (require.main === module) {
    rollbackMigration();
}

module.exports = { rollbackMigration };
