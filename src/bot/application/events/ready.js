/**
 * Ready Event Handler
 * 
 * Fired when the bot is logged in and ready to start working.
 * Handles command registration and guild initialization.
 */

const BaseEvent = require('../../system/core/BaseEvent');

class ReadyEvent extends BaseEvent {
    constructor(client) {
        super(client, {
            name: 'ready',
            once: true,
        });
    }

    async execute() {
        this.log(`Bot is ready! Logged in as ${this.client.user.tag}`, 'info');
        this.log(`Serving ${this.client.guilds.cache.size} guilds`, 'info');

        // Register slash commands after bot is ready
        try {
            await this.registerCommands();
        } catch (error) {
            this.log('Failed to register commands after ready', 'error', {
                error: error.message,
                stack: error.stack,
            });
        }

        // Initialize all guilds in database
        try {
            await this.initializeGuilds();
        } catch (error) {
            this.log('Failed to initialize guilds', 'error', {
                error: error.message,
                stack: error.stack,
            });
        }

        // Restore music queues from database
        try {
            await this.restoreMusicQueues();
        } catch (error) {
            this.log('Failed to restore music queues', 'error', {
                error: error.message,
                stack: error.stack,
            });
        }

        // Start CleanupManager for periodic cleanup tasks
        this.startCleanupManager();

        // Start periodic health checks
        this.startHealthChecks();

        // Set bot presence
        this.client.user.setPresence({
            activities: [{ name: 'music | /play', type: 0 }],
            status: 'online',
        });
    }

    /**
     * Register slash commands from all loaded modules
     */
    async registerCommands() {
        try {
            this.log('Registering slash commands...', 'info');

            const config = require('../config/config');
            const modules = this.client.modules || new Map();

            // Collect all commands from loaded modules
            const commands = [];

            for (const [, module] of modules) {
                for (const command of module.commands) {
                    // Build command data for Discord API
                    const commandData = {
                        name: command.name,
                        description: command.description,
                        options: command.options || [],
                    };

                    commands.push(commandData);
                }
            }

            this.log(`Registering ${commands.length} commands...`, 'info');

            // Register commands
            if (config.guildId && config.isDevelopment) {
                // Register to specific guild for faster updates during development
                const guild = await this.client.guilds.fetch(config.guildId);
                await guild.commands.set(commands);
                this.log(`Commands registered to guild: ${guild.name}`, 'info');
            } else {
                // Register globally (takes up to 1 hour to propagate)
                await this.client.application.commands.set(commands);
                this.log('Commands registered globally', 'info');
            }

            this.log('Command registration complete', 'info');
        } catch (error) {
            this.log('Failed to register commands', 'error', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Initialize all guilds in database
     */
    async initializeGuilds() {
        try {
            // Get GuildInitializationService
            const guildInitService = this.getGuildInitializationService();

            if (guildInitService) {
                // Use GuildInitializationService for full initialization
                this.log('Initializing all guilds using GuildInitializationService...', 'info');

                let successCount = 0;
                let failCount = 0;

                for (const [guildId, guild] of this.client.guilds.cache) {
                    try {
                        const result = await guildInitService.initializeGuild(guild);

                        if (result.success) {
                            successCount++;

                            if (!result.alreadyInitialized) {
                                this.log(
                                    `Initialized guild ${guild.name} with ${result.memberCount} members`,
                                    'info'
                                );
                            }
                        }
                    } catch (error) {
                        failCount++;
                        this.log(`Failed to initialize guild ${guild.name}`, 'error', {
                            guildId,
                            error: error.message,
                        });
                    }
                }

                this.log(
                    `Guild initialization complete: ${successCount} successful, ${failCount} failed`,
                    'info'
                );
            } else {
                // Fallback to basic initialization
                this.log('GuildInitializationService not available, using fallback initialization', 'warn');

                const GuildModel = require('../models/GuildModel');
                const model = new GuildModel({ client: this.client });

                for (const [guildId, guild] of this.client.guilds.cache) {
                    try {
                        await model.initializeGuild(guildId, guild.name);
                    } catch (error) {
                        this.log(`Failed to initialize guild ${guild.name}`, 'error', {
                            guildId,
                            error: error.message,
                        });
                    }
                }

                this.log(`Initialized ${this.client.guilds.cache.size} guilds (basic)`, 'info');
            }
        } catch (error) {
            this.log('Failed to initialize guilds', 'error', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Get GuildInitializationService from client
     * @returns {Object|null} GuildInitializationService instance or null
     */
    getGuildInitializationService() {
        try {
            // Service is registered globally on client
            if (this.client.guildInitializationService) {
                return this.client.guildInitializationService;
            }

            // Try to get from services map if available
            if (this.client.services && this.client.services.has('GuildInitializationService')) {
                return this.client.services.get('GuildInitializationService');
            }

            return null;
        } catch (error) {
            this.log(`Error getting GuildInitializationService: ${error.message}`, 'error');
            return null;
        }
    }

    /**
     * Restore music queues from database
     * Loads saved queue states and attempts to restore playback
     */
    async restoreMusicQueues() {
        try {
            // Get MusicPlayerService
            const musicModule = this.client.modules.get('music');
            if (!musicModule) {
                this.log('Music module not loaded, skipping queue restoration', 'warn');
                return;
            }

            const musicPlayerService = musicModule.getService('MusicPlayerService');
            if (!musicPlayerService) {
                this.log('MusicPlayerService not available, skipping queue restoration', 'warn');
                return;
            }

            // Clean up corrupt queue states first
            try {
                const cleanedCount = await musicPlayerService.cleanupCorruptQueues();
                if (cleanedCount > 0) {
                    this.log(`Cleaned up ${cleanedCount} corrupt queue states`, 'info');
                }
            } catch (error) {
                this.log('Failed to cleanup corrupt queues', 'warn', {
                    error: error.message
                });
            }

            this.log('Restoring music queues from database...', 'info');

            let restoredCount = 0;
            let failedCount = 0;

            // Iterate through all guilds
            for (const [guildId, guild] of this.client.guilds.cache) {
                try {
                    // Load queue state from database
                    const queueData = await musicPlayerService.loadQueue(guildId);

                    if (!queueData || !queueData.tracks || queueData.tracks.length === 0) {
                        continue;
                    }

                    // Restore queue state
                    const queueManager = musicPlayerService.queueManager;
                    const queue = queueManager.getQueue(guildId);

                    // Restore tracks
                    queue.tracks = queueData.tracks || [];
                    queue.current = queueData.current || null;
                    queue.loop = queueData.loopMode || 'off';
                    queue.volume = queueData.volume || 80;

                    restoredCount++;
                    this.log(
                        `Restored queue for guild ${guild.name} with ${queue.tracks.length} tracks`,
                        'info'
                    );

                    // Note: We don't auto-resume playback as the bot may not be in a voice channel
                    // Users will need to use /resume or /play to continue
                } catch (error) {
                    failedCount++;
                    this.log(`Failed to restore queue for guild ${guildId}`, 'error', {
                        error: error.message,
                    });
                }
            }

            if (restoredCount > 0) {
                this.log(
                    `Queue restoration complete: ${restoredCount} restored, ${failedCount} failed`,
                    'info'
                );
            } else {
                this.log('No queues to restore', 'info');
            }
        } catch (error) {
            this.log('Failed to restore music queues', 'error', {
                error: error.message,
                stack: error.stack,
            });
        }
    }

    /**
     * Start CleanupManager for periodic cleanup tasks
     * Manages cleanup for caches, game states, and queue states
     */
    startCleanupManager() {
        try {
            if (this.client.cleanupManager) {
                this.client.cleanupManager.start();
                this.log('CleanupManager started successfully', 'info');
            } else {
                this.log('CleanupManager not available', 'warn');
            }
        } catch (error) {
            this.log('Failed to start CleanupManager', 'error', {
                error: error.message,
                stack: error.stack,
            });
        }
    }

    /**
     * Start periodic health checks
     * Monitors database, connection pool, cache, and migrations
     */
    startHealthChecks() {
        try {
            if (this.client.healthCheckService) {
                // Start periodic health checks (every 5 minutes by default)
                this.client.healthCheckService.startPeriodicChecks();
                this.log('Periodic health checks started successfully', 'info', {
                    interval: this.client.healthCheckService.config.checkInterval,
                });
            } else {
                this.log('HealthCheckService not available', 'warn');
            }
        } catch (error) {
            this.log('Failed to start periodic health checks', 'error', {
                error: error.message,
                stack: error.stack,
            });
        }
    }
}

module.exports = ReadyEvent;
