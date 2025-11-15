const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { retryWithBackoff } = require('../helpers/retry_helper');
const logger = require('../helpers/logger_helper');

/**
 * VoiceManager Library
 * Manages voice connections for all guilds
 * Handles join/leave voice channel and connection lifecycle
 */
class VoiceManager {
    constructor(instance, params = {}) {
        this.instance = instance;
        this.connections = new Map();
        this.timeout = params.timeout || 300000; // 5 minutes default
        this.reconnectAttempts = new Map(); // Track reconnection attempts per guild
        this.maxReconnectAttempts = 3;
    }

    /**
     * Join a voice channel
     * @param {VoiceChannel} voiceChannel - The voice channel to join
     * @param {TextChannel} textChannel - The text channel for notifications
     * @returns {VoiceConnection} The voice connection
     */
    async join(voiceChannel, textChannel) {
        const guildId = voiceChannel.guild.id;

        // If already connected, return existing connection
        if (this.connections.has(guildId)) {
            const existing = this.connections.get(guildId);

            // If connected to same channel, return it
            if (existing.voiceChannel.id === voiceChannel.id) {
                return existing.connection;
            }

            // Otherwise, destroy old connection and create new one
            existing.connection.destroy();
            this.connections.delete(guildId);
        }

        try {
            // Use retry logic for joining voice channel
            const connection = await retryWithBackoff(
                async () => {
                    // Create voice connection
                    const conn = joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: guildId,
                        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                    });

                    // Wait for connection to be ready
                    await entersState(conn, VoiceConnectionStatus.Ready, 30000);

                    return conn;
                },
                {
                    maxRetries: 2,
                    initialDelay: 1000,
                    onRetry: (error, attempt) => {
                        logger.warn(`Retrying voice connection for guild ${guildId}`, {
                            attempt: attempt + 1,
                            error: error.message,
                        });
                    },
                }
            );

            // Store connection info
            this.connections.set(guildId, {
                connection,
                voiceChannel,
                textChannel,
                joinedAt: Date.now(),
            });

            // Reset reconnect attempts on successful connection
            this.reconnectAttempts.delete(guildId);

            // Setup connection event handlers
            this.setupConnectionHandlers(guildId, connection);

            logger.info(`Successfully joined voice channel in guild ${guildId}`);

            return connection;
        } catch (error) {
            // Cleanup on failure
            this.connections.delete(guildId);
            logger.error(`Failed to join voice channel in guild ${guildId}`, {
                error: error.message,
                stack: error.stack,
            });
            throw new Error(`Failed to join voice channel: ${error.message}`);
        }
    }

    /**
     * Leave a voice channel
     * @param {string} guildId - The guild ID
     */
    leave(guildId) {
        const conn = this.connections.get(guildId);
        if (conn) {
            try {
                conn.connection.destroy();
            } catch (error) {
                // Ignore errors during cleanup
            }
            this.connections.delete(guildId);
        }
    }

    /**
     * Get connection info for a guild
     * @param {string} guildId - The guild ID
     * @returns {Object|null} Connection info or null
     */
    get(guildId) {
        return this.connections.get(guildId) || null;
    }

    /**
     * Check if bot is connected in a guild
     * @param {string} guildId - The guild ID
     * @returns {boolean} True if connected
     */
    isConnected(guildId) {
        return this.connections.has(guildId);
    }

    /**
     * Get all active connections
     * @returns {Map} Map of all connections
     */
    getAllConnections() {
        return this.connections;
    }

    /**
     * Setup event handlers for a connection
     * @param {string} guildId - The guild ID
     * @param {VoiceConnection} connection - The voice connection
     */
    setupConnectionHandlers(guildId, connection) {
        // Handle disconnection with auto-reconnect
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                logger.warn(`Voice connection disconnected in guild ${guildId}, attempting to reconnect`);

                // Try to reconnect with timeout
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5000),
                ]);

                logger.info(`Voice connection reconnected in guild ${guildId}`);
                // Reconnected successfully, reset attempts
                this.reconnectAttempts.delete(guildId);
            } catch (error) {
                logger.error(`Failed to auto-reconnect in guild ${guildId}`, {
                    error: error.message,
                });

                // Try manual reconnection with retry logic
                await this.attemptReconnect(guildId);
            }
        });

        // Handle destruction
        connection.on(VoiceConnectionStatus.Destroyed, () => {
            logger.info(`Voice connection destroyed in guild ${guildId}`);
            this.connections.delete(guildId);
            this.reconnectAttempts.delete(guildId);
        });

        // Handle errors with recovery
        connection.on('error', async (error) => {
            logger.error(`Voice connection error in guild ${guildId}`, {
                error: error.message,
                stack: error.stack,
            });

            // Try to recover from error
            await this.handleConnectionError(guildId, error);
        });
    }

    /**
     * Attempt to reconnect to voice channel
     * @param {string} guildId - The guild ID
     */
    async attemptReconnect(guildId) {
        const connInfo = this.connections.get(guildId);
        if (!connInfo) {
            return;
        }

        // Get current reconnect attempts
        const attempts = this.reconnectAttempts.get(guildId) || 0;

        // Check if we've exceeded max attempts
        if (attempts >= this.maxReconnectAttempts) {
            logger.error(`Max reconnect attempts reached for guild ${guildId}, giving up`);
            this.leave(guildId);

            // Notify in text channel if available
            if (connInfo.textChannel) {
                try {
                    await connInfo.textChannel.send(
                        '❌ Lost connection to voice channel and failed to reconnect. Please use the play command again.'
                    );
                } catch (error) {
                    // Ignore notification errors
                }
            }
            return;
        }

        // Increment attempts
        this.reconnectAttempts.set(guildId, attempts + 1);

        logger.info(`Attempting manual reconnect for guild ${guildId} (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);

        try {
            // Destroy old connection
            connInfo.connection.destroy();

            // Wait a bit before reconnecting
            await new Promise(resolve => setTimeout(resolve, 2000 * (attempts + 1)));

            // Try to rejoin
            await this.join(connInfo.voiceChannel, connInfo.textChannel);

            logger.info(`Successfully reconnected to voice channel in guild ${guildId}`);

            // Notify in text channel if available
            if (connInfo.textChannel) {
                try {
                    await connInfo.textChannel.send('✅ Reconnected to voice channel!');
                } catch (error) {
                    // Ignore notification errors
                }
            }
        } catch (error) {
            logger.error(`Reconnect attempt failed for guild ${guildId}`, {
                error: error.message,
                attempt: attempts + 1,
            });

            // Try again if we haven't exceeded max attempts
            if (attempts + 1 < this.maxReconnectAttempts) {
                await this.attemptReconnect(guildId);
            } else {
                this.leave(guildId);
            }
        }
    }

    /**
     * Handle connection error
     * @param {string} guildId - The guild ID
     * @param {Error} error - The error
     */
    async handleConnectionError(guildId, error) {
        const connInfo = this.connections.get(guildId);
        if (!connInfo) {
            return;
        }

        // Check if error is recoverable
        const isRecoverable = this.isRecoverableError(error);

        if (isRecoverable) {
            logger.info(`Attempting to recover from voice error in guild ${guildId}`);
            await this.attemptReconnect(guildId);
        } else {
            logger.error(`Non-recoverable voice error in guild ${guildId}, disconnecting`);
            this.leave(guildId);

            // Notify in text channel if available
            if (connInfo.textChannel) {
                try {
                    await connInfo.textChannel.send(
                        '❌ A voice connection error occurred. Please try again.'
                    );
                } catch (error) {
                    // Ignore notification errors
                }
            }
        }
    }

    /**
     * Check if error is recoverable
     * @param {Error} error - The error to check
     * @returns {boolean} True if error is recoverable
     */
    isRecoverableError(error) {
        const recoverableErrors = [
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ENETUNREACH',
            'connection',
            'timeout',
            'network',
        ];

        const message = error.message?.toLowerCase() || '';
        const code = error.code?.toLowerCase() || '';

        return recoverableErrors.some(keyword =>
            message.includes(keyword) || code.includes(keyword)
        );
    }

    /**
     * Cleanup idle connections
     * Removes connections that have been idle for too long
     */
    cleanupIdleConnections() {
        const now = Date.now();
        for (const [guildId, conn] of this.connections.entries()) {
            if (now - conn.joinedAt > this.timeout) {
                this.leave(guildId);
            }
        }
    }

    /**
     * Cleanup all connections
     * Used during bot shutdown
     */
    cleanup() {
        for (const guildId of this.connections.keys()) {
            this.leave(guildId);
        }
    }
}

module.exports = VoiceManager;
