/**
 * CleanupManager
 * 
 * Centralized manager for periodic cleanup tasks.
 * Handles cleanup of expired cache entries, game states, and queue states.
 */

class CleanupManager {
    /**
     * Create a new CleanupManager instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.logger = client.logger;

        // Cleanup intervals
        this.intervals = {
            cache: null,        // Every 1 minute
            games: null,        // Every 5 minutes
            queues: null,       // Every 24 hours
        };

        // Track if manager is running
        this.isRunning = false;
    }

    /**
     * Start all cleanup intervals
     */
    start() {
        if (this.isRunning) {
            this.log('CleanupManager is already running', 'warn');
            return;
        }

        this.log('Starting CleanupManager', 'info');

        // Cache cleanup - every 1 minute
        this.intervals.cache = setInterval(() => {
            this.cleanupCaches();
        }, 60 * 1000);

        // Game state cleanup - every 5 minutes
        this.intervals.games = setInterval(() => {
            this.cleanupGameStates();
        }, 5 * 60 * 1000);

        // Queue state cleanup - every 24 hours
        this.intervals.queues = setInterval(() => {
            this.cleanupQueueStates();
        }, 24 * 60 * 60 * 1000);

        this.isRunning = true;

        // Run initial cleanup after 1 minute
        setTimeout(() => {
            this.cleanupCaches();
            this.cleanupGameStates();
            this.cleanupQueueStates();
        }, 60 * 1000);
    }

    /**
     * Stop all cleanup intervals
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        this.log('Stopping CleanupManager', 'info');

        // Clear all intervals
        for (const [name, interval] of Object.entries(this.intervals)) {
            if (interval) {
                clearInterval(interval);
                this.intervals[name] = null;
            }
        }

        this.isRunning = false;
    }

    /**
     * Cleanup expired cache entries
     * Cleans up caches from various services
     */
    async cleanupCaches() {
        try {
            this.log('Running cache cleanup', 'debug');

            let totalRemoved = 0;

            // Cleanup GuildConfigService cache
            const adminModule = this.client.modules.get('admin');
            if (adminModule) {
                const guildConfigService = adminModule.getService('GuildConfigService');
                if (guildConfigService && typeof guildConfigService.cleanupExpiredCache === 'function') {
                    guildConfigService.cleanupExpiredCache();
                    const stats = guildConfigService.getCacheStats();
                    this.log(`GuildConfig cache: ${stats.size} entries, ${stats.hitRate} hit rate`, 'debug');
                }
            }

            // Cleanup MusicModel track cache
            const musicModule = this.client.modules.get('music');
            if (musicModule && this.client.loader) {
                try {
                    const musicModel = this.client.loader.model('MusicModel');
                    if (musicModel && musicModel.trackCache) {
                        const removed = musicModel.trackCache.cleanup();
                        totalRemoved += removed;

                        const stats = musicModel.getCacheStats();
                        this.log(`Track cache: ${stats.size} entries, ${stats.hitRate} hit rate`, 'debug');
                    }
                } catch (error) {
                    this.log(`Error cleaning up MusicModel cache: ${error.message}`, 'debug');
                }
            }

            if (totalRemoved > 0) {
                this.log(`Cache cleanup completed: ${totalRemoved} expired entries removed`, 'info');
            }
        } catch (error) {
            this.log(`Error during cache cleanup: ${error.message}`, 'error');
        }
    }

    /**
     * Cleanup expired game states
     * Removes games older than 5 minutes from GameService
     */
    async cleanupGameStates() {
        try {
            this.log('Running game state cleanup', 'debug');

            const economyModule = this.client.modules.get('economy');
            if (!economyModule) {
                return;
            }

            const gameService = economyModule.getService('GameService');
            if (!gameService || typeof gameService.cleanupExpiredGames !== 'function') {
                return;
            }

            // Get count before cleanup
            const beforeCount = gameService.activeGames.size;

            // Run cleanup
            gameService.cleanupExpiredGames();

            // Get count after cleanup
            const afterCount = gameService.activeGames.size;
            const removed = beforeCount - afterCount;

            if (removed > 0) {
                this.log(`Game state cleanup completed: ${removed} expired games removed`, 'info');
            }
        } catch (error) {
            this.log(`Error during game state cleanup: ${error.message}`, 'error');
        }
    }

    /**
     * Cleanup expired queue states
     * Removes queue states older than 24 hours from database
     */
    async cleanupQueueStates() {
        try {
            this.log('Running queue state cleanup', 'debug');

            const musicModule = this.client.modules.get('music');
            if (!musicModule) {
                return;
            }

            const musicPlayerService = musicModule.getService('MusicPlayerService');
            if (!musicPlayerService || typeof musicPlayerService.cleanupExpiredQueues !== 'function') {
                return;
            }

            // Run cleanup
            await musicPlayerService.cleanupExpiredQueues();

            this.log('Queue state cleanup completed', 'info');
        } catch (error) {
            this.log(`Error during queue state cleanup: ${error.message}`, 'error');
        }
    }

    /**
     * Log message with CleanupManager context
     * @param {string} message - Log message
     * @param {string} level - Log level
     */
    log(message, level = 'info') {
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level](`[CleanupManager] ${message}`);
        }
    }

    /**
     * Get cleanup statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        const stats = {
            isRunning: this.isRunning,
            intervals: {
                cache: this.intervals.cache !== null,
                games: this.intervals.games !== null,
                queues: this.intervals.queues !== null,
            },
        };

        // Add cache stats if available
        const adminModule = this.client.modules.get('admin');
        if (adminModule) {
            const guildConfigService = adminModule.getService('GuildConfigService');
            if (guildConfigService) {
                stats.guildConfigCache = guildConfigService.getCacheStats();
            }
        }

        // Add track cache stats if available
        const musicModel = this.client.loader.model('MusicModel');
        if (musicModel && musicModel.trackCache) {
            stats.trackCache = musicModel.getCacheStats();
        }

        // Add game stats if available
        const economyModule = this.client.modules.get('economy');
        if (economyModule) {
            const gameService = economyModule.getService('GameService');
            if (gameService) {
                stats.activeGames = gameService.activeGames.size;
            }
        }

        return stats;
    }
}

module.exports = CleanupManager;
