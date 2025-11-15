/**
 * MusicPlayerService
 * 
 * Service for managing music playback and queue operations.
 * Handles playback control, queue management, and queue persistence.
 */

const BaseService = require('../../../../system/core/BaseService');
const { AudioPlayerStatus } = require('@discordjs/voice');
const { v4: uuidv4 } = require('uuid');

class MusicPlayerService extends BaseService {
    /**
     * Create a new MusicPlayerService instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Service configuration options
     */
    constructor(client, options = {}) {
        super(client, options);

        // Libraries and models will be loaded in initialize()
        this.voiceManager = null;
        this.audioPlayer = null;
        this.queueManager = null;
        this.musicModel = null;
        this.guildConfigService = null;

        // Track current playback state for persistence
        this.playbackStates = new Map();
    }

    /**
     * Initialize service
     * @returns {Promise<void>}
     */
    async initialize() {
        await super.initialize();

        // Load libraries using client.loader
        const loader = this.client.loader;
        if (loader) {
            this.voiceManager = loader.library('VoiceManager');
            this.audioPlayer = loader.library('AudioPlayer');
            this.queueManager = loader.library('QueueManager');
            this.musicModel = loader.model('MusicModel');
        }

        // Get GuildConfigService
        const adminModule = this.client.modules.get('admin');
        this.guildConfigService = adminModule ? adminModule.getService('GuildConfigService') : null;

        this.log('MusicPlayerService initialized', 'info');
    }

    /**
     * Play a track or add to queue
     * @param {Object} params - Play parameters
     * @param {string} params.guildId - Guild ID
     * @param {string} params.query - Track query or URL
     * @param {Object} params.voiceChannel - Voice channel to join
     * @param {Object} params.textChannel - Text channel for messages
     * @param {Object} params.requester - User who requested the track
     * @returns {Promise<Object>} Result with track and position
     */
    async play({ guildId, query, voiceChannel, textChannel, requester }) {
        this.validateRequired({ guildId, query, voiceChannel, requester },
            ['guildId', 'query', 'voiceChannel', 'requester']);

        try {
            // Check max queue size
            if (this.guildConfigService) {
                const maxQueueSize = await this.guildConfigService.getSetting(guildId, 'max_queue_size');
                const currentQueueSize = this.queueManager.getSize(guildId);

                if (currentQueueSize >= maxQueueSize) {
                    throw new Error(`Queue is full! Maximum queue size is ${maxQueueSize} tracks.`);
                }
            }

            // Get track info
            this.log(`Fetching track info for query: ${query}`, 'info');
            const trackInfo = await this.musicModel.getTrackInfo(query);

            // Join voice channel
            this.log(`Joining voice channel: ${voiceChannel.name}`, 'info');
            await this.voiceManager.join(voiceChannel, textChannel);

            // Create track object
            const track = {
                ...trackInfo,
                requestedBy: {
                    id: requester.id,
                    tag: requester.tag,
                },
            };

            // Add to queue
            const position = this.queueManager.add(guildId, track);
            this.log(`Added track to queue at position ${position}`, 'info');

            // If first track, start playing
            if (position === 1 && !this.queueManager.getCurrent(guildId)) {
                await this.startPlayback(guildId);
            }

            // Save queue state
            await this.saveQueue(guildId);

            return { track, position };
        } catch (error) {
            throw this.handleError(error, 'play');
        }
    }

    /**
     * Start playback for a guild
     * @param {string} guildId - Guild ID
     * @returns {Promise<void>}
     */
    async startPlayback(guildId) {
        try {
            const track = this.queueManager.next(guildId);

            if (!track) {
                this.log(`No more tracks in queue for guild ${guildId}`, 'info');
                // Queue is empty, leave voice channel after a delay
                setTimeout(() => {
                    if (this.queueManager.isEmpty(guildId)) {
                        this.voiceManager.leave(guildId);
                        this.queueManager.removeQueue(guildId);
                        this.audioPlayer.removePlayer(guildId);
                        this.clearSavedQueue(guildId);
                    }
                }, 60000); // 1 minute delay
                return;
            }

            this.log(`Starting playback for track: ${track.title}`, 'info');

            // Get current filter
            const filter = this.queueManager.getFilter(guildId);

            // Get player and play track with filter
            const player = await this.audioPlayer.play(guildId, track, filter);
            const connection = this.voiceManager.get(guildId);

            if (!connection) {
                throw new Error('Voice connection not found');
            }

            // Subscribe connection to player
            connection.connection.subscribe(player);

            // Set volume
            let volume = this.queueManager.getVolume(guildId);

            // If volume is default (80), check guild settings
            if (volume === 80 && this.guildConfigService) {
                try {
                    const defaultVolume = await this.guildConfigService.getSetting(guildId, 'volume_default');
                    if (defaultVolume !== undefined && defaultVolume !== null) {
                        volume = defaultVolume;
                        this.queueManager.setVolume(guildId, volume);
                    }
                } catch (error) {
                    this.log(`Error getting default volume: ${error.message}`, 'warn');
                }
            }

            this.audioPlayer.setVolume(guildId, volume);

            // Track playback state
            this.playbackStates.set(guildId, {
                startTime: Date.now(),
                track: track,
            });

            // Handle track end
            player.once(AudioPlayerStatus.Idle, () => {
                this.log(`Track finished, playing next track`, 'info');
                this.playbackStates.delete(guildId);
                this.startPlayback(guildId);
            });

            // Handle errors
            player.once('error', (error) => {
                this.log(`Player error: ${error.message}`, 'error');
                this.playbackStates.delete(guildId);
                // Try to play next track
                this.startPlayback(guildId);
            });

            // Save queue state
            await this.saveQueue(guildId);

            // Send now playing message
            if (connection.textChannel) {
                await this.sendNowPlayingMessage(connection.textChannel, track);
            }
        } catch (error) {
            this.handleError(error, 'startPlayback');

            // Try to play next track on error
            const hasMoreTracks = this.queueManager.getSize(guildId) > 0;
            if (hasMoreTracks) {
                setTimeout(() => this.startPlayback(guildId), 1000);
            } else {
                // No more tracks, cleanup
                this.voiceManager.leave(guildId);
                this.queueManager.removeQueue(guildId);
                this.audioPlayer.removePlayer(guildId);
                await this.clearSavedQueue(guildId);
            }
        }
    }

    /**
     * Pause playback
     * @param {string} guildId - Guild ID
     * @returns {boolean} True if paused successfully
     */
    pause(guildId) {
        return this.audioPlayer.pause(guildId);
    }

    /**
     * Resume playback
     * @param {string} guildId - Guild ID
     * @returns {boolean} True if resumed successfully
     */
    resume(guildId) {
        return this.audioPlayer.resume(guildId);
    }

    /**
     * Skip current track
     * @param {string} guildId - Guild ID
     * @returns {Object|null} Skipped track or null
     */
    skip(guildId) {
        const current = this.queueManager.getCurrent(guildId);
        if (current) {
            this.audioPlayer.stop(guildId);
        }
        return current;
    }

    /**
     * Stop playback and clear queue
     * @param {string} guildId - Guild ID
     * @returns {Promise<void>}
     */
    async stop(guildId) {
        this.queueManager.clear(guildId);
        this.audioPlayer.stop(guildId);
        this.voiceManager.leave(guildId);
        this.queueManager.removeQueue(guildId);
        this.audioPlayer.removePlayer(guildId);
        this.playbackStates.delete(guildId);
        await this.clearSavedQueue(guildId);
    }

    /**
     * Set volume
     * @param {string} guildId - Guild ID
     * @param {number} volume - Volume level (0-100)
     * @returns {Promise<boolean>} True if volume set successfully
     */
    async setVolume(guildId, volume) {
        this.queueManager.setVolume(guildId, volume);
        const success = this.audioPlayer.setVolume(guildId, volume);
        if (success) {
            await this.saveQueue(guildId);
        }
        return success;
    }

    /**
     * Set loop mode
     * @param {string} guildId - Guild ID
     * @param {string} mode - Loop mode ('off', 'track', 'queue')
     * @returns {Promise<boolean>} True if mode set successfully
     */
    async setLoop(guildId, mode) {
        const success = this.queueManager.setLoop(guildId, mode);
        if (success) {
            await this.saveQueue(guildId);
        }
        return success;
    }

    /**
     * Set audio filter
     * @param {string} guildId - Guild ID
     * @param {string} filter - Filter type ('none', 'bassboost', 'nightcore', 'vaporwave', '8d', 'karaoke')
     * @returns {Promise<boolean>} True if filter set successfully
     */
    async setFilter(guildId, filter) {
        const success = this.queueManager.setFilter(guildId, filter);
        if (success) {
            // Restart playback with new filter
            const current = this.queueManager.getCurrent(guildId);
            if (current && this.audioPlayer.isPlaying(guildId)) {
                // Stop current playback
                this.audioPlayer.stop(guildId);

                // Get player and play track with filter
                const player = await this.audioPlayer.play(guildId, current, filter);
                const connection = this.voiceManager.get(guildId);

                if (connection) {
                    // Subscribe connection to player
                    connection.connection.subscribe(player);

                    // Restore volume
                    const volume = this.queueManager.getVolume(guildId);
                    this.audioPlayer.setVolume(guildId, volume);

                    // Track playback state
                    this.playbackStates.set(guildId, {
                        startTime: Date.now(),
                        track: current,
                    });

                    // Handle track end
                    player.once(AudioPlayerStatus.Idle, () => {
                        this.log(`Track finished, playing next track`, 'info');
                        this.playbackStates.delete(guildId);
                        this.startPlayback(guildId);
                    });

                    // Handle errors
                    player.once('error', (error) => {
                        this.log(`Player error: ${error.message}`, 'error');
                        this.playbackStates.delete(guildId);
                        this.startPlayback(guildId);
                    });
                }
            }

            // Save queue state with new filter
            await this.saveQueue(guildId);
        }
        return success;
    }

    /**
     * Get current audio filter
     * @param {string} guildId - Guild ID
     * @returns {string} Current filter
     */
    getFilter(guildId) {
        return this.queueManager.getFilter(guildId);
    }

    /**
     * Seek to specific position in current track
     * @param {string} guildId - Guild ID
     * @param {number} position - Position in seconds
     * @returns {Promise<boolean>} True if seek successful
     */
    async seek(guildId, position) {
        try {
            const current = this.queueManager.getCurrent(guildId);

            if (!current) {
                throw new Error('No track is currently playing');
            }

            // Validate position
            if (position < 0) {
                throw new Error('Position cannot be negative');
            }

            if (position > current.duration) {
                throw new Error(`Position exceeds track duration (${current.duration}s)`);
            }

            // Check if bot is playing
            if (!this.audioPlayer.isPlaying(guildId) && !this.audioPlayer.isPaused(guildId)) {
                throw new Error('No active playback to seek');
            }

            this.log(`Seeking to ${position}s in track: ${current.title}`, 'info');

            // Get current filter
            const filter = this.queueManager.getFilter(guildId);

            // Stop current playback
            this.audioPlayer.stop(guildId);

            // Get player and play track with filter and position
            const player = await this.audioPlayer.play(guildId, current, filter, position);
            const connection = this.voiceManager.get(guildId);

            if (!connection) {
                throw new Error('Voice connection not found');
            }

            // Subscribe connection to player
            connection.connection.subscribe(player);

            // Restore volume
            const volume = this.queueManager.getVolume(guildId);
            this.audioPlayer.setVolume(guildId, volume);

            // Track playback state with adjusted start time
            this.playbackStates.set(guildId, {
                startTime: Date.now() - (position * 1000), // Adjust start time for seek position
                track: current,
            });

            // Handle track end
            player.once(AudioPlayerStatus.Idle, () => {
                this.log(`Track finished, playing next track`, 'info');
                this.playbackStates.delete(guildId);
                this.startPlayback(guildId);
            });

            // Handle errors
            player.once('error', (error) => {
                this.log(`Player error: ${error.message}`, 'error');
                this.playbackStates.delete(guildId);
                this.startPlayback(guildId);
            });

            // Save queue state with new position
            await this.saveQueue(guildId);

            return true;
        } catch (error) {
            throw this.handleError(error, 'seek');
        }
    }

    /**
     * Shuffle queue
     * @param {string} guildId - Guild ID
     * @returns {Promise<void>}
     */
    async shuffle(guildId) {
        this.queueManager.shuffle(guildId);
        await this.saveQueue(guildId);
    }

    /**
     * Clear queue
     * @param {string} guildId - Guild ID
     * @returns {Promise<void>}
     */
    async clearQueue(guildId) {
        this.queueManager.clear(guildId);
        await this.saveQueue(guildId);
    }

    /**
     * Remove track from queue
     * @param {string} guildId - Guild ID
     * @param {number} position - Position to remove (1-based)
     * @returns {Promise<Object|null>} Removed track or null
     */
    async removeTrack(guildId, position) {
        const removed = this.queueManager.remove(guildId, position);
        if (removed) {
            await this.saveQueue(guildId);
        }
        return removed;
    }

    /**
     * Jump to specific track in queue
     * @param {string} guildId - Guild ID
     * @param {number} position - Position to jump to (1-based)
     * @returns {Promise<Object|null>} Track at position or null
     */
    async jumpTo(guildId, position) {
        const track = this.queueManager.skipTo(guildId, position);
        if (track) {
            this.audioPlayer.stop(guildId);
            await this.saveQueue(guildId);
        }
        return track;
    }

    /**
     * Move track to different position
     * @param {string} guildId - Guild ID
     * @param {number} from - Current position (1-based)
     * @param {number} to - Target position (1-based)
     * @returns {Promise<boolean>} True if moved successfully
     */
    async moveTrack(guildId, from, to) {
        const success = this.queueManager.move(guildId, from, to);
        if (success) {
            await this.saveQueue(guildId);
        }
        return success;
    }

    /**
     * Get queue information
     * @param {string} guildId - Guild ID
     * @returns {Object} Queue object
     */
    getQueue(guildId) {
        return this.queueManager.getQueue(guildId);
    }

    /**
     * Get current track
     * @param {string} guildId - Guild ID
     * @returns {Object|null} Current track or null
     */
    getCurrent(guildId) {
        return this.queueManager.getCurrent(guildId);
    }

    /**
     * Check if playing
     * @param {string} guildId - Guild ID
     * @returns {boolean} True if playing
     */
    isPlaying(guildId) {
        return this.audioPlayer.isPlaying(guildId);
    }

    /**
     * Check if paused
     * @param {string} guildId - Guild ID
     * @returns {boolean} True if paused
     */
    isPaused(guildId) {
        return this.audioPlayer.isPaused(guildId);
    }

    /**
     * Check if connected to voice
     * @param {string} guildId - Guild ID
     * @returns {boolean} True if connected
     */
    isConnected(guildId) {
        return this.voiceManager.isConnected(guildId);
    }

    /**
     * Get current playback position in seconds
     * @param {string} guildId - Guild ID
     * @returns {number} Current position in seconds
     */
    getCurrentPosition(guildId) {
        const playbackState = this.playbackStates.get(guildId);

        if (!playbackState) {
            return 0;
        }

        // Calculate elapsed time since playback started
        const elapsed = Math.floor((Date.now() - playbackState.startTime) / 1000);

        // Ensure position doesn't exceed track duration
        const current = this.queueManager.getCurrent(guildId);
        if (current && elapsed > current.duration) {
            return current.duration;
        }

        return Math.max(0, elapsed);
    }

    /**
     * Save queue state to database
     * @param {string} guildId - Guild ID
     * @returns {Promise<void>}
     */
    async saveQueue(guildId) {
        try {
            const queue = this.queueManager.getQueue(guildId);

            // Validate queue exists and has data
            if (!queue || !queue.tracks || queue.tracks.length === 0) {
                this.log(`No valid queue to save for guild ${guildId}`, 'debug');
                return;
            }

            const playbackState = this.playbackStates.get(guildId);

            // Calculate current position in track
            let currentPosition = 0;
            if (playbackState && this.audioPlayer.isPlaying(guildId)) {
                currentPosition = Math.floor((Date.now() - playbackState.startTime) / 1000);
            }

            const queueData = {
                tracks: queue.tracks,
                current: queue.current,
                currentPosition: currentPosition,
                loopMode: queue.loop,
                volume: queue.volume,
                filter: queue.filter || 'none',
            };

            // Validate queueData before stringifying
            if (!queueData.tracks || !Array.isArray(queueData.tracks)) {
                this.log(`Invalid queue data for guild ${guildId}, skipping save`, 'warn');
                return;
            }

            const db = this.getDatabase();
            if (!db) return;

            // Stringify and validate JSON
            let queueDataJson;
            try {
                queueDataJson = JSON.stringify(queueData);
                // Validate it can be parsed back
                JSON.parse(queueDataJson);
            } catch (jsonError) {
                this.log(`Failed to serialize queue data for guild ${guildId}: ${jsonError.message}`, 'error');
                return;
            }

            // Upsert queue state
            const stmt = db.prepare(`
                INSERT INTO music_queue_state (guild_id, queue_data, current_position, loop_mode, volume, filter, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(guild_id) DO UPDATE SET
                    queue_data = excluded.queue_data,
                    current_position = excluded.current_position,
                    loop_mode = excluded.loop_mode,
                    volume = excluded.volume,
                    filter = excluded.filter,
                    updated_at = CURRENT_TIMESTAMP
            `);

            stmt.run(
                guildId,
                queueDataJson,
                currentPosition,
                queue.loop,
                queue.volume,
                queue.filter || 'none'
            );

            this.log(`Saved queue state for guild ${guildId}`, 'debug');
        } catch (error) {
            this.handleError(error, 'saveQueue');
        }
    }

    /**
     * Load queue state from database
     * @param {string} guildId - Guild ID
     * @returns {Promise<Object|null>} Queue data or null
     */
    async loadQueue(guildId) {
        try {
            const db = this.getDatabase();
            if (!db) return null;

            const stmt = db.prepare(`
                SELECT queue_data, current_position, loop_mode, volume, filter
                FROM music_queue_state
                WHERE guild_id = ?
            `);

            const row = stmt.get(guildId);
            if (!row) {
                // No saved queue - this is normal, not an error
                this.log(`No saved queue found for guild ${guildId}`, 'debug');
                return null;
            }

            // Check if queue_data is empty/null (normal - no queue saved)
            if (!row.queue_data) {
                this.log(`No queue data for guild ${guildId}`, 'debug');
                return null;
            }

            // Check for corrupt data (string "undefined" or "null" - this is a problem)
            if (row.queue_data === 'undefined' || row.queue_data === 'null') {
                this.log(`Corrupt queue_data for guild ${guildId} (string "${row.queue_data}"), cleaning up`, 'warn');
                // Clean up corrupt entry
                await this.clearSavedQueue(guildId);
                return null;
            }

            let queueData;
            try {
                queueData = JSON.parse(row.queue_data);
            } catch (parseError) {
                this.log(`Failed to parse queue_data for guild ${guildId}: ${parseError.message}, cleaning up`, 'error');
                // Clean up corrupt entry
                await this.clearSavedQueue(guildId);
                return null;
            }

            // Validate parsed data structure
            if (!queueData || typeof queueData !== 'object') {
                this.log(`Invalid queue_data structure for guild ${guildId}, cleaning up`, 'warn');
                // Clean up corrupt entry
                await this.clearSavedQueue(guildId);
                return null;
            }

            // Check if queue has tracks (if not, it's empty - normal)
            if (!queueData.tracks || !Array.isArray(queueData.tracks) || queueData.tracks.length === 0) {
                this.log(`Empty queue for guild ${guildId}`, 'debug');
                return null;
            }

            this.log(`Loaded queue state for guild ${guildId}`, 'debug');

            return {
                ...queueData,
                currentPosition: row.current_position,
                loopMode: row.loop_mode,
                volume: row.volume,
                filter: row.filter,
            };
        } catch (error) {
            this.handleError(error, 'loadQueue');
            return null;
        }
    }

    /**
     * Clear saved queue state
     * @param {string} guildId - Guild ID
     * @returns {Promise<void>}
     */
    async clearSavedQueue(guildId) {
        try {
            const db = this.getDatabase();
            if (!db) return;

            const stmt = db.prepare('DELETE FROM music_queue_state WHERE guild_id = ?');
            stmt.run(guildId);

            this.log(`Cleared saved queue for guild ${guildId}`, 'debug');
        } catch (error) {
            this.handleError(error, 'clearSavedQueue');
        }
    }

    /**
     * Clean up corrupt queue states from database
     * @returns {Promise<number>} Number of corrupt entries removed
     */
    async cleanupCorruptQueues() {
        try {
            const db = this.getDatabase();
            if (!db) {
                this.log('Database not available, skipping cleanup', 'warn');
                return 0;
            }

            this.log('Scanning for corrupt queue states...', 'debug');

            // Get all queue states using BaseService query method
            const rows = await this.query('SELECT guild_id, queue_data FROM music_queue_state');

            if (!rows || !Array.isArray(rows) || rows.length === 0) {
                this.log('No queue states in database', 'debug');
                return 0;
            }

            let corruptCount = 0;
            const corruptGuildIds = [];

            for (const row of rows) {
                let isCorrupt = false;

                // Only check for CORRUPT data, not empty data
                // Empty/null is normal and should not be flagged as corrupt

                if (row.queue_data === 'undefined' || row.queue_data === 'null') {
                    // String "undefined" or "null" is corrupt
                    isCorrupt = true;
                } else if (row.queue_data) {
                    // Has data - try to parse
                    try {
                        const parsed = JSON.parse(row.queue_data);
                        if (!parsed || typeof parsed !== 'object') {
                            isCorrupt = true;
                        }
                        // Note: Empty tracks array is OK, not corrupt
                    } catch (error) {
                        // Parse error = corrupt
                        isCorrupt = true;
                    }
                }
                // If queue_data is null/empty, it's NOT corrupt, just empty

                if (isCorrupt) {
                    corruptGuildIds.push(row.guild_id);
                    corruptCount++;
                }
            }

            // Delete corrupt entries
            if (corruptGuildIds.length > 0) {
                this.log(`Found ${corruptCount} corrupt queue states, cleaning up...`, 'warn');
                for (const guildId of corruptGuildIds) {
                    await this.query('DELETE FROM music_queue_state WHERE guild_id = ?', [guildId]);
                    this.log(`Removed corrupt queue state for guild ${guildId}`, 'debug');
                }
                this.log(`Cleanup complete: ${corruptCount} corrupt queue states removed`, 'info');
            } else {
                this.log('No corrupt queue states found', 'debug');
            }

            return corruptCount;
        } catch (error) {
            this.handleError(error, 'cleanupCorruptQueues');
            return 0;
        }
    }

    /**
     * Cleanup expired queue states (older than 24 hours)
     * @returns {Promise<void>}
     */
    async cleanupExpiredQueues() {
        try {
            const db = this.getDatabase();
            if (!db) return;

            const stmt = db.prepare(`
                DELETE FROM music_queue_state
                WHERE updated_at < datetime('now', '-24 hours')
            `);

            const result = stmt.run();

            if (result.changes > 0) {
                this.log(`Cleaned up ${result.changes} expired queue states`, 'info');
            }
        } catch (error) {
            this.handleError(error, 'cleanupExpiredQueues');
        }
    }

    /**
     * Send now playing message
     * @param {Object} textChannel - Text channel
     * @param {Object} track - Track object
     * @returns {Promise<void>}
     */
    async sendNowPlayingMessage(textChannel, track) {
        try {
            const { EmbedBuilder } = require('discord.js');
            const { formatDuration } = require('../../../../system/helpers/format_helper');

            const embed = new EmbedBuilder()
                .setColor(0x00b894)
                .setTitle('🎵 Now Playing')
                .setDescription(`[${track.title}](${track.url})`)
                .addFields(
                    { name: 'Duration', value: formatDuration(track.duration), inline: true },
                    { name: 'Requested By', value: `<@${track.requestedBy.id}>`, inline: true }
                )
                .setThumbnail(track.thumbnail)
                .setTimestamp();

            await textChannel.send({ embeds: [embed] });
        } catch (error) {
            this.handleError(error, 'sendNowPlayingMessage');
        }
    }
}

module.exports = MusicPlayerService;
