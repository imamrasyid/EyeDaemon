'use strict';

/**
 * Migration Status Script
 * 
 * Inspects migration status on the database.
 */

require('dotenv').config();
const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');
const MigrationManager = require('../system/database/MigrationManager');
const logger = require('../system/helpers/LoggerHelper');

async function migrationStatus() {
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
            logger: logger,
        };

        const migrationManager = new MigrationManager(databaseWrapper, {
            migrationsPath: path.join(__dirname, '..', 'migrations'),
        });

        console.log(`📊 Checking migration status for [${dbUrl}]...\n`);

        const status = await migrationManager.getStatus();

        console.log(`Total migrations:    ${status.total}`);
        console.log(`Executed migrations: ${status.executed}`);
        console.log(`Pending migrations:  ${status.pending}`);
        console.log(`Last batch:          ${status.lastBatch}\n`);

        if (status.executedMigrations.length > 0) {
            console.log('✅ Executed:');
            status.executedMigrations.forEach(m => console.log(`   - ${m}`));
        }

        if (status.pendingMigrations.length > 0) {
            console.log('\n⏳ Pending:');
            status.pendingMigrations.forEach(m => console.log(`   - ${m}`));
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Failed to get migration status:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    migrationStatus();
}

module.exports = { migrationStatus };
