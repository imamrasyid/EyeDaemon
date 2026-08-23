'use strict';

const {
    createAudioPlayer,
    createAudioResource,
    StreamType,
    AudioPlayerStatus,
    NoSubscriberBehavior,
} = require('@discordjs/voice');
const logger = require('../helpers/LoggerHelper');
const { AudioError } = require('../core/Errors');
const AudioStreamService = require('../services/AudioStreamService');

/**
 * AudioPlayer Library
 * Manages audio playback for all guilds directly in-process.
 * Eliminates HTTP loopbacks and separate server process requirements.
 */
class AudioPlayer {
    constructor(instance, params = {}) {
        this.instance = instance;
        this.players = new Map();
        this.audioStreamService = new AudioStreamService(instance, params);
    }

    /**
     * Get or create audio player for a guild
     * @param {string} guildId - The guild ID
     * @returns {import('@discordjs/voice').AudioPlayer} The audio player
     */
    getPlayer(guildId) {
        if (!this.players.has(guildId)) {
            const player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Pause,
                },
            });

            this.players.set(guildId, player);

            // Setup error handling
            player.on('error', (error) => {
                logger.error(`Audio player error in guild ${guildId}`, {
                    error: error.message,
                    stack: error.stack,
                });

                if (this.instance && typeof this.instance.emit === 'function') {
                    this.instance.emit('audioPlayerError', {
                        guildId,
                        error,
                        userMessage: this.getUserFriendlyErrorMessage(error),
                    });
                }
            });
        }
        return this.players.get(guildId);
    }

    /**
     * Play a track
     * @param {string} guildId - The guild ID
     * @param {Object} track - The track object
     * @param {string} filter - Optional audio filter to apply
     * @param {number} position - Optional start position in seconds
     * @returns {Promise<import('@discordjs/voice').AudioPlayer>} The audio player
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

            throw new AudioError(
                this.getUserFriendlyErrorMessage(error),
                { guildId, track, originalError: error.message }
            );
        }
    }

    /**
     * Create audio resource directly from in-process stream
     * @param {Object} track - Track object
     * @param {string} filter - Optional audio filter
     * @param {number} position - Optional seek position in seconds
     * @returns {Promise<import('@discordjs/voice').AudioResource>}
     */
    async createAudioResource(track, filter = 'none', position = 0) {
        try {
            const query = track.query || track.url;
            const stream = await this.audioStreamService.getAudioStream({
                query,
                streamUrl: track.streamUrl,
                start: position,
                filter,
                format: 'webm',
            });

            return createAudioResource(stream, {
                inputType: StreamType.WebmOpus,
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
     * Pause playback
     * @param {string} guildId - Guild ID
     * @returns {boolean}
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
     * @param {string} guildId - Guild ID
     * @returns {boolean}
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
     * @param {string} guildId - Guild ID
     * @returns {boolean}
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
     * @param {string} guildId - Guild ID
     * @returns {string|null}
     */
    getStatus(guildId) {
        const player = this.players.get(guildId);
        return player ? player.state.status : null;
    }

    /**
     * Check if player is playing
     * @param {string} guildId - Guild ID
     * @returns {boolean}
     */
    isPlaying(guildId) {
        const player = this.players.get(guildId);
        return player && player.state.status === AudioPlayerStatus.Playing;
    }

    /**
     * Check if player is paused
     * @param {string} guildId - Guild ID
     * @returns {boolean}
     */
    isPaused(guildId) {
        const player = this.players.get(guildId);
        return player && player.state.status === AudioPlayerStatus.Paused;
    }

    /**
     * Set volume for a player
     * @param {string} guildId - Guild ID
     * @param {number} volume - Volume level (0-100)
     * @returns {boolean}
     */
    setVolume(guildId, volume) {
        const player = this.players.get(guildId);
        if (player && player.state.resource && player.state.resource.volume) {
            const volumeLevel = Math.max(0, Math.min(100, volume)) / 100;
            player.state.resource.volume.setVolume(volumeLevel);
            return true;
        }
        return false;
    }

    /**
     * Remove player for a guild
     * @param {string} guildId - Guild ID
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
     * @returns {string}
     */
    getUserFriendlyErrorMessage(error) {
        const message = error.message?.toLowerCase() || '';

        if (message.includes('unavailable') || message.includes('not found') || message.includes('404')) {
            return '❌ This track is unavailable or has been removed.';
        }
        if (message.includes('restricted') || message.includes('403') || message.includes('forbidden')) {
            return '❌ Access to this track is restricted.';
        }
        if (message.includes('stream') || message.includes('no audio')) {
            return '❌ Failed to stream audio. The track might be unavailable.';
        }
        if (message.includes('timeout') || message.includes('timed out')) {
            return '❌ Request timed out. Please try again.';
        }
        return '❌ Failed to play audio. Please try again.';
    }

    /**
     * Cleanup all players
     */
    cleanup() {
        for (const [, player] of this.players.entries()) {
            player.stop();
        }
        this.players.clear();
    }
}

module.exports = AudioPlayer;
