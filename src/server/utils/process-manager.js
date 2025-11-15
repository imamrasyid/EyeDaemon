/**
 * Process Management Utilities
 * Utilities for safe child process cleanup and timeout handling
 */

const logger = require('./logger');

/**
 * Kill a child process safely with timeout
 * @param {ChildProcess} process - The child process to kill
 * @param {number} timeout - Timeout in milliseconds before force kill
 * @returns {Promise<void>}
 */
async function killProcessSafely(process, timeout = 5000) {
    if (!process || process.killed) {
        return;
    }

    return new Promise((resolve) => {
        const forceKillTimeout = setTimeout(() => {
            if (!process.killed) {
                logger.warn('Force killing process', { pid: process.pid });
                process.kill('SIGKILL');
            }
            resolve();
        }, timeout);

        process.on('exit', () => {
            clearTimeout(forceKillTimeout);
            resolve();
        });

        // Try graceful termination first
        try {
            process.kill('SIGTERM');
        } catch (error) {
            logger.error('Error killing process', { error: error.message });
            clearTimeout(forceKillTimeout);
            resolve();
        }
    });
}

/**
 * Setup timeout for a child process
 * @param {ChildProcess} process - The child process
 * @param {number} timeout - Timeout in milliseconds
 * @param {Function} onTimeout - Callback when timeout occurs
 * @returns {Function} Cleanup function to clear the timeout
 */
function setupProcessTimeout(process, timeout, onTimeout) {
    const timeoutId = setTimeout(() => {
        logger.warn('Process timeout', { pid: process.pid, timeout });
        if (onTimeout) {
            onTimeout();
        }
        killProcessSafely(process);
    }, timeout);

    // Clear timeout when process exits
    process.on('exit', () => {
        clearTimeout(timeoutId);
    });

    // Return cleanup function
    return () => {
        clearTimeout(timeoutId);
    };
}

/**
 * Cleanup multiple processes
 * @param {ChildProcess[]} processes - Array of child processes
 * @returns {Promise<void>}
 */
async function cleanupProcesses(processes) {
    if (!Array.isArray(processes) || processes.length === 0) {
        return;
    }

    logger.info('Cleaning up processes', { count: processes.length });

    const cleanupPromises = processes
        .filter((p) => p && !p.killed)
        .map((p) => killProcessSafely(p));

    await Promise.allSettled(cleanupPromises);
}

/**
 * Create a process with automatic cleanup on error
 * @param {Function} spawnFn - Function that spawns the process
 * @param {Object} options - Options
 * @param {number} options.timeout - Timeout in milliseconds
 * @param {Function} options.onError - Error callback
 * @returns {ChildProcess}
 */
function createManagedProcess(spawnFn, options = {}) {
    const { timeout, onError } = options;
    const process = spawnFn();

    // Setup timeout if specified
    if (timeout) {
        setupProcessTimeout(process, timeout, () => {
            if (onError) {
                onError(new Error('Process timeout'));
            }
        });
    }

    // Handle process errors
    process.on('error', (error) => {
        logger.error('Process error', { error: error.message, pid: process.pid });
        if (onError) {
            onError(error);
        }
    });

    return process;
}

module.exports = {
    killProcessSafely,
    setupProcessTimeout,
    cleanupProcesses,
    createManagedProcess,
};
