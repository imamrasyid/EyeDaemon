'use strict';

/**
 * Server Helper
 * 
 * Utilities for inspecting embedded HTTP server state in the unified runtime.
 */

const http = require('http');
const config = require('../../application/config/config');

/**
 * Check if the embedded HTTP server is responding
 * @param {number} [port]
 * @param {number} [timeout]
 * @returns {Promise<boolean>}
 */
function isServerAlive(port = config?.server?.port || 3000, timeout = 3000) {
    return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
            resolve(res.statusCode === 200);
        });

        req.on('error', () => resolve(false));
        req.setTimeout(timeout, () => {
            req.destroy();
            resolve(false);
        });
    });
}

module.exports = {
    isServerAlive,
};
