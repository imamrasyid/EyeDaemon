'use strict';

/**
 * LibsqlHelper - Platform-agnostic LibSQL client loader
 * Handles seamless loading of @libsql/client/http on Android/Termux and remote DBs,
 * and @libsql/client on desktop platforms with native SQLite support.
 */

function createLibsqlClient(config = {}) {
    const url = config.url || '';
    const isRemote = url.startsWith('libsql://') || url.startsWith('https://') || url.startsWith('http://');

    // If remote URL, always use pure JS HTTP client (works anywhere without native compilation)
    if (isRemote) {
        try {
            const { createClient } = require('@libsql/client/http');
            return createClient(config);
        } catch (httpErr) {
            try {
                const { createClient } = require('@libsql/client/web');
                return createClient(config);
            } catch {}
        }
    }

    // If local file / in-memory DB:
    try {
        const { createClient } = require('@libsql/client');
        return createClient(config);
    } catch (err) {
        if (process.platform === 'android' || err.message?.includes('@libsql/android')) {
            throw new Error(
                `Local SQLite files (${url}) cannot be opened directly on Android/Termux because LibSQL does not provide prebuilt @libsql/android-arm64 binaries. Please configure TURSO_DATABASE_URL with a remote Turso database (libsql://...) and TURSO_AUTH_TOKEN in your .env file.`
            );
        }
        throw err;
    }
}

module.exports = {
    createLibsqlClient,
};
