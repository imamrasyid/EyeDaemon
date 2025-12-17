const {
    createAudioPlayer,
    createAudioResource,
    StreamType,
    AudioPlayerStatus,
    NoSubscriberBehavior,
} = require('@discordjs/voice');
const axios = require('axios');
const config = require('../../application/config/config');
const { retryWithBackoff, isNetworkError } = require('../helpers/retry_helper');
const logger = require('../helpers/logger_helper');
const { AudioError } = require('../core/Errors');

/**
 * AudioPlayer Library
 * Manages audio playback for all guilds
 * Handles audio streaming and playback events via local audio server
 */
class AudioPlayer {
    constructor(instance, params = {}) {
        this.instance = instance;
        this.players = new Map();
        this.audioServerUrl = config.audio.sourceEndpoint;
    }

    /**
     * Get or create audio player for a guild
     * @param {string} guildId - The guild ID
     * @returns {AudioPlayer} The audio player
     */
    getPlayer(guildId) {
        if (!this.players.has(guildId)) {
            const player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Pause,
                },
            });

            // Store player
            this.players.set(guildId, player);

            // Setup error handling
            player.on('error', (error) => {
                logger.error(`Audio player error in guild ${guildId}`, {
                    error: error.message,
                    stack: error.stack,
                });

                // Emit custom error event for handling by services
                this.instance.emit('audioPlayerError', {
                    guildId,
                    error,
                    userMessage: this.getUserFriendlyErrorMessage(error),
                });
            });
        }
        return this.players.get(guildId);
    }

    /**
     * Play a track
     * @param {string} guildId - The guild ID
     * @param {Object} track - The track object with url
     * @param {string} filter - Optional audio filter to apply
     * @param {number} position - Optional start position in seconds
     * @returns {AudioPlayer} The audio player
     */
    async play(guildId, track, filter = 'none', position = 0) {
        try {
            const player = this.getPlayer(guildId);
            const resource = await this.createAudioResource(track, filter, position);
            player.play(resource);
            return player;
        } catch (error) {
            logger.error(`Failed to play track in guild ${guildId}`, {
                error: error.message,
                track: track.title || track.url,
            });

            // Throw user-friendly error
            throw new AudioError(
                this.getUserFriendlyErrorMessage(error),
                { guildId, track, originalError: error.message }
            );
        }
    }

    /**
     * Create audio resource from track
     * @param {Object} track - The track object with query or url
     * @param {string} filter - Optional audio filter to apply
     * @param {number} position - Optional start position in seconds
     * @returns {AudioResource} The audio resource
     */
    async createAudioResource(track, filter = 'none', position = 0) {
        try {
            // Use original query if available, otherwise use URL
            const query = track.query || track.url;
            const stream = await this.getAudioStream(query, filter, position);
            return createAudioResource(stream, {
                inputType: StreamType.Arbitrary,
                inlineVolume: true,
            });
        } catch (error) {
            logger.error('Failed to create audio resource', {
                error: error.message,
                track: track.title || track.url,
            });
            throw new AudioError(
                `Failed to create audio resource: ${error.message}`,
                { track, originalError: error.message }
            );
        }
    }

    /**
     * Get audio stream from local audio server
     * @param {string} query - The track query or URL
     * @param {string} filter - Optional audio filter to apply
     * @param {number} position - Optional start position in seconds
     * @returns {Stream} The audio stream
     */
    async getAudioStream(query, filter = 'none', position = 0) {
        // Use retry logic for getting audio stream
        return retryWithBackoff(
            async () => {
                try {
                    // Request audio stream from local audio server
                    const params = { query };

                    // Add filter parameter if not 'none'
                    if (filter && filter !== 'none') {
                        params.filter = filter;
                    }

                    // Add position parameter if not 0
                    if (position > 0) {
                        params.position = position;
                    }

                    const response = await axios.get(`${this.audioServerUrl}/api/audio/stream`, {
                        params: params,
                        responseType: 'stream',
                        timeout: 30000, // 30 second timeout
                    });

                    if (!response.data) {
                        throw new AudioError('No audio stream received from server');
                    }

                    return response.data;
                } catch (error) {
                    // Log detailed error
                    logger.error('Failed to get audio stream', {
                        error: error.message,
                        query,
                        filter,
                        position,
                    });

                    // Check if it's a network error that should be retried
                    if (isNetworkError(error)) {
                        throw error; // Will be retried
                    }

                    // Check for specific error types
                    if (error.response) {
                        // Server responded with error
                        if (error.response.status === 404) {
                            throw new AudioError('Track not found or unavailable');
                        }
                        if (error.response.status === 403) {
                            throw new AudioError('Access to track is restricted');
                        }
                        if (error.response.status >= 500) {
                            throw new AudioError('Audio server is experiencing issues');
                        }
                    }

                    // Rethrow with more context
                    throw new AudioError(`Failed to get audio stream: ${error.message}`);
                }
            },
            {
                maxRetries: 2,
                initialDelay: 1000,
                shouldRetry: (error) => {
                    // Only retry network errors, not application errors
                    return isNetworkError(error);
                },
                onRetry: (error, attempt) => {
                    logger.warn('Retrying audio stream request', {
                        attempt: attempt + 1,
                        error: error.message,
                        query,
                    });
                },
            }
        );
    }

    /**
     * Pause playback
     * @param {string} guildId - The guild ID
     * @returns {boolean} True if paused successfully
     */
    pause(guildId) {
        const player = this.players.get(guildId);
        if (player && player.state.status === AudioPlayerStatus.Playing) {
            player.pause();
            return true;
        }
        return false;
    }

    /**
     * Resume playback
     * @param {string} guildId - The guild ID
     * @returns {boolean} True if resumed successfully
     */
    resume(guildId) {
        const player = this.players.get(guildId);
        if (player && player.state.status === AudioPlayerStatus.Paused) {
            player.unpause();
            return true;
        }
        return false;
    }

    /**
     * Stop playback
     * @param {string} guildId - The guild ID
     * @returns {boolean} True if stopped successfully
     */
    stop(guildId) {
        const player = this.players.get(guildId);
        if (player) {
            player.stop();
            return true;
        }
        return false;
    }

    /**
     * Get player status
     * @param {string} guildId - The guild ID
     * @returns {string|null} The player status or null
     */
    getStatus(guildId) {
        const player = this.players.get(guildId);
        return player ? player.state.status : null;
    }

    /**
     * Check if player is playing
     * @param {string} guildId - The guild ID
     * @returns {boolean} True if playing
     */
    isPlaying(guildId) {
        const player = this.players.get(guildId);
        return player && player.state.status === AudioPlayerStatus.Playing;
    }

    /**
     * Check if player is paused
     * @param {string} guildId - The guild ID
     * @returns {boolean} True if paused
     */
    isPaused(guildId) {
        const player = this.players.get(guildId);
        return player && player.state.status === AudioPlayerStatus.Paused;
    }

    /**
     * Set volume for a player
     * @param {string} guildId - The guild ID
     * @param {number} volume - Volume level (0-100)
     * @returns {boolean} True if volume set successfully
     */
    setVolume(guildId, volume) {
        const player = this.players.get(guildId);
        if (player && player.state.resource && player.state.resource.volume) {
            // Convert 0-100 to 0-1
            const volumeLevel = Math.max(0, Math.min(100, volume)) / 100;
            player.state.resource.volume.setVolume(volumeLevel);
            return true;
        }
        return false;
    }

    /**
     * Remove player for a guild
     * @param {string} guildId - The guild ID
     */
    removePlayer(guildId) {
        const player = this.players.get(guildId);
        if (player) {
            player.stop();
            this.players.delete(guildId);
        }
    }

    /**
     * Get user-friendly error message
     * @param {Error} error - The error
     * @returns {string} User-friendly error message
     */
    getUserFriendlyErrorMessage(error) {
        const message = error.message?.toLowerCase() || '';

        // Network errors
        if (isNetworkError(error)) {
            return '❌ Network error occurred. Please check your connection and try again.';
        }

        // Audio server errors
        if (message.includes('audio server')) {
            return '❌ The audio server is currently unavailable. Please try again later.';
        }

        // Track unavailable
        if (message.includes('unavailable') || message.includes('not found') || message.includes('404')) {
            return '❌ This track is unavailable or has been removed.';
        }

        // Access restricted
        if (message.includes('restricted') || message.includes('403') || message.includes('forbidden')) {
            return '❌ Access to this track is restricted.';
        }

        // Stream errors
        if (message.includes('stream') || message.includes('no audio')) {
            return '❌ Failed to stream audio. The track might be unavailable.';
        }

        // Timeout errors
        if (message.includes('timeout') || message.includes('timed out')) {
            return '❌ Request timed out. Please try again.';
        }

        // Format errors
        if (message.includes('format') || message.includes('codec')) {
            return '❌ This audio format is not supported.';
        }

        // Generic error
        return '❌ Failed to play audio. Please try again.';
    }

    /**
     * Cleanup all players
     * Used during bot shutdown
     */
    cleanup() {
        for (const [guildId, player] of this.players.entries()) {
            player.stop();
        }
        this.players.clear();
    }
}

module.exports = AudioPlayer;
