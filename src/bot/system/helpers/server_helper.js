/**
 * Server Helper
 * 
 * Utilities untuk memastikan audio source server berjalan
 * sebelum bot dimulai. Mendukung berbagai platform termasuk Termux.
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const logger = require('./logger_helper');
const config = require('../../application/config/config');

/**
 * Mengecek apakah server sudah berjalan
 * 
 * @param {string} url - URL server untuk dicek (default: audio server endpoint/health)
 * @param {number} timeout - Timeout dalam ms (default: 5000)
 * @returns {Promise<boolean>} - true jika server hidup, false jika tidak
 */
function getAudioBaseUrl() {
    const endpoint = config?.audio?.sourceEndpoint;
    return endpoint.replace(/\/$/, '');
}

function isServerAlive(url = `${getAudioBaseUrl()}/health`, timeout = 5000) {
    return new Promise((resolve) => {
        const request = http.get(url, (res) => {
            // Server merespons, anggap hidup
            resolve(res.statusCode === 200);
        });

        request.on('error', () => {
            // Server tidak merespons
            resolve(false);
        });

        request.setTimeout(timeout, () => {
            request.destroy();
            resolve(false);
        });
    });
}

/**
 * Menjalankan server di background
 * 
 * Mendukung berbagai platform:
 * - Windows (PowerShell/CMD)
 * - Linux/macOS
 * - Termux (Android)
 * 
 * @returns {ChildProcess} - Process yang dijalankan
 */
function startServer() {
    const serverPath = path.join(__dirname, '../../../server/server.js');

    logger.info('Starting audio source server in background...', {
        serverPath,
        platform: process.platform,
    });

    // Jalankan server di background (cross-platform)
    const child = spawn('node', [serverPath], {
        detached: true,
        stdio: 'ignore', // Ignore output agar tidak mengganggu bot logs
        cwd: path.join(__dirname, '../../../server'),
    });

    // Unref agar process bisa berjalan independen
    child.unref();

    return child;
}

/**
 * Memastikan server berjalan sebelum melanjutkan
 * 
 * Workflow:
 * 1. Cek apakah server sudah berjalan
 * 2. Jika belum, jalankan server
 * 3. Tunggu sampai server ready (dengan retry)
 * 
 * @param {Object} options - Opsi konfigurasi
 * @param {string} options.url - URL untuk health check
 * @param {number} options.maxRetries - Maksimal retry (default: 10)
 * @param {number} options.retryDelay - Delay antar retry dalam ms (default: 1000)
 * @returns {Promise<void>}
 * @throws {Error} - Jika server gagal start setelah max retries
 */
async function ensureServerRunning(options = {}) {
    const {
        url = `${getAudioBaseUrl()}/health`,
        maxRetries = 10,
        retryDelay = 1000,
    } = options;

    // Cek apakah server sudah berjalan
    const isAlive = await isServerAlive(url);

    if (isAlive) {
        logger.info('Audio source server is already running');
        return;
    }

    logger.info('Audio source server not running, starting now...');

    // Start server
    startServer();

    // Tunggu sampai server ready dengan retry
    for (let i = 0; i < maxRetries; i++) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));

        const ready = await isServerAlive(url);

        if (ready) {
            logger.info('Audio source server started successfully', {
                retriesNeeded: i + 1,
            });
            return;
        }

        logger.debug(`Waiting for server to be ready... (attempt ${i + 1}/${maxRetries})`);
    }

    // Jika sampai sini, server gagal start
    throw new Error(`Failed to start audio source server after ${maxRetries} attempts`);
}

module.exports = {
    isServerAlive,
    startServer,
    ensureServerRunning,
};
