/**
 * MusicPlayerService
 * 
 * Service for managing music playback and queue operations.
 * Handles playback control, queue management, and queue persistence.
 */

const BaseService = require('../../../../system/core/BaseService');
const { AudioPlayerStatus } = require('@discordjs/voice');

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
        // Each entry: { startTime, track, pausedAt }
        // startTime is adjusted on seek so elapsed = Date.now() - startTime
        // pausedAt is set when paused, cleared on resume
        this.playbackStates = new Map();

        // Prefetch cache: guildId → Promise<trackInfo>
        // Warmed up while current track is playing so next track starts instantly
        this._prefetchCache = new Map();

        // In-memory cache for guild volume defaults to avoid DB read on every track
        this._volumeDefaults = new Map();
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

            // Fetch metadata and join voice channel concurrently — saves ~1-2s
            this.log(`Fetching track info and joining voice channel concurrently`, 'info');
            const [trackInfo] = await Promise.all([
                this.musicModel.getTrackInfo(query),
                this.voiceManager.join(voiceChannel, textChannel),
            ]);

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

            // Fire-and-forget: queue persistence doesn't need to block the response
            this.saveQueue(guildId).catch(err =>
                this.log(`saveQueue error: ${err.message}`, 'warn')
            );

            return { track, position };
        } catch (error) {
            throw this.handleError(error, 'play');
        }
    }

    /**
     * Prefetch metadata for the next track in queue.
     * Called after current track starts playing so the next track's metadata
     * is already cached when startPlayback() is called.
     * @param {string} guildId
     * @private
     */
    _prefetchNext(guildId) {
        const queue = this.queueManager.getQueue(guildId);
        const nextTrack = queue.tracks[0];

        if (!nextTrack || !nextTrack.query) return;

        // Don't prefetch if already in flight or cached
        if (this._prefetchCache.has(guildId)) return;

        this.log(`Prefetching next track: ${nextTrack.title}`, 'debug');

        const promise = this.musicModel.getTrackInfo(nextTrack.query).catch((err) => {
            this.log(`Prefetch failed for ${nextTrack.title}: ${err.message}`, 'warn');
        }).finally(() => {
            this._prefetchCache.delete(guildId);
        });

        this._prefetchCache.set(guildId, promise);
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

            // Set volume — use cached default to avoid DB read on every track
            let volume = this.queueManager.getVolume(guildId);

            if (volume === 80 && this.guildConfigService) {
                if (!this._volumeDefaults.has(guildId)) {
                    // First track for this guild: fetch once and cache
                    try {
                        const defaultVolume = await this.guildConfigService.getSetting(guildId, 'volume_default');
                        if (defaultVolume !== undefined && defaultVolume !== null) {
                            this._volumeDefaults.set(guildId, defaultVolume);
                        }
                    } catch (err) {
                        this.log(`Error getting default volume: ${err.message}`, 'warn');
                    }
                }
                const cached = this._volumeDefaults.get(guildId);
                if (cached !== undefined) {
                    volume = cached;
                    this.queueManager.setVolume(guildId, volume);
                }
            }

            this.audioPlayer.setVolume(guildId, volume);

            // Track playback state
            this.playbackStates.set(guildId, {
                startTime: Date.now(),
                track: track,
                pausedAt: null,
            });

            // Remove any stale Idle/error listeners before attaching new ones
            // to prevent double-trigger when seek/setFilter/stop is called
            player.removeAllListeners(AudioPlayerStatus.Idle);
            player.removeAllListeners('error');

            // Handle track end
            player.once(AudioPlayerStatus.Idle, () => {
                this.log(`Track finished, playing next track`, 'info');
                this.playbackStates.delete(guildId);
                this._prefetchCache.delete(guildId);
                this.startPlayback(guildId);
            });

            // Handle errors
            player.once('error', (error) => {
                this.log(`Player error: ${error.message}`, 'error');
                this.playbackStates.delete(guildId);
                this._prefetchCache.delete(guildId);
                // Invalidate cache for this track so next play re-fetches fresh metadata
                if (track.query && this.musicModel) {
                    this.musicModel.invalidate(track.query);
                }
                // Try to play next track
                this.startPlayback(guildId);
            });

            // Fire-and-forget: DB write and Discord message don't block audio start
            this.saveQueue(guildId).catch(err =>
                this.log(`saveQueue error: ${err.message}`, 'warn')
            );
            if (connection.textChannel) {
                this.sendNowPlayingMessage(connection.textChannel, track).catch(err =>
                    this.log(`sendNowPlayingMessage error: ${err.message}`, 'warn')
                );
            }

            // Prefetch next track metadata while current track plays
            this._prefetchNext(guildId);
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
        const success = this.audioPlayer.pause(guildId);
        if (success) {
            const state = this.playbackStates.get(guildId);
            if (state && !state.pausedAt) {
                state.pausedAt = Date.now();
            }
        }
        return success;
    }

    /**
     * Resume playback
     * @param {string} guildId - Guild ID
     * @returns {boolean} True if resumed successfully
     */
    resume(guildId) {
        const success = this.audioPlayer.resume(guildId);
        if (success) {
            const state = this.playbackStates.get(guildId);
            if (state && state.pausedAt) {
                // Shift startTime forward by the duration we were paused
                state.startTime += Date.now() - state.pausedAt;
                state.pausedAt = null;
            }
        }
        return success;
    }

    /**
     * Skip current track
     * @param {string} guildId - Guild ID
     * @returns {Object|null} Skipped track or null
     */
    skip(guildId) {
        const current = this.queueManager.getCurrent(guildId);
        if (current) {
            // Remove Idle listener before stopping to prevent double startPlayback()
            // The Idle event fires when stop() is called, but we want to control
            // the next startPlayback() call ourselves (or let the Idle handler do it once)
            const player = this.audioPlayer.getPlayer(guildId);
            if (player) {
                player.removeAllListeners(AudioPlayerStatus.Idle);
                player.removeAllListeners('error');
            }
            this.audioPlayer.stop(guildId);
            this.playbackStates.delete(guildId);
            // Trigger next track manually
            this.startPlayback(guildId);
        }
        return current;
    }

    /**
     * Stop playback and clear queue
     * @param {string} guildId - Guild ID
     * @returns {Promise<void>}
     */
    async stop(guildId) {
        // Remove listeners before stopping to prevent startPlayback() from firing
        const player = this.audioPlayer.getPlayer(guildId);
        if (player) {
            player.removeAllListeners(AudioPlayerStatus.Idle);
            player.removeAllListeners('error');
        }
        this.queueManager.clear(guildId);
        this.audioPlayer.stop(guildId);
        this.voiceManager.leave(guildId);
        this.queueManager.removeQueue(guildId);
        this.audioPlayer.removePlayer(guildId);
        this.playbackStates.delete(guildId);
        this._prefetchCache.delete(guildId);
        this._volumeDefaults.delete(guildId);
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
            // Restart playback with new filter if playing OR paused
            const current = this.queueManager.getCurrent(guildId);
            const isActive = this.audioPlayer.isPlaying(guildId) || this.audioPlayer.isPaused(guildId);
            if (current && isActive) {
                // Capture current position before stopping
                const currentPos = this.getCurrentPosition(guildId);

                // Remove listeners before stopping to prevent double startPlayback()
                const player = this.audioPlayer.getPlayer(guildId);
                if (player) {
                    player.removeAllListeners(AudioPlayerStatus.Idle);
                    player.removeAllListeners('error');
                }

                this.audioPlayer.stop(guildId);

                // Get new player and play track with filter from current position
                const newPlayer = await this.audioPlayer.play(guildId, current, filter, currentPos);
                const connection = this.voiceManager.get(guildId);

                if (connection) {
                    connection.connection.subscribe(newPlayer);

                    const volume = this.queueManager.getVolume(guildId);
                    this.audioPlayer.setVolume(guildId, volume);

                    // Reset playback state with adjusted start time
                    this.playbackStates.set(guildId, {
                        startTime: Date.now() - (currentPos * 1000),
                        track: current,
                        pausedAt: null,
                    });

                    newPlayer.removeAllListeners(AudioPlayerStatus.Idle);
                    newPlayer.removeAllListeners('error');

                    newPlayer.once(AudioPlayerStatus.Idle, () => {
                        this.log(`Track finished, playing next track`, 'info');
                        this.playbackStates.delete(guildId);
                        this.startPlayback(guildId);
                    });

                    newPlayer.once('error', (error) => {
                        this.log(`Player error: ${error.message}`, 'error');
                        this.playbackStates.delete(guildId);
                        this.startPlayback(guildId);
                    });
                }
            }

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

            // position is in seconds, current.duration is in milliseconds
            if (position * 1000 > current.duration) {
                throw new Error(`Position exceeds track duration (${Math.floor(current.duration / 1000)}s)`);
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
                pausedAt: null,
            });

            // Remove stale listeners before attaching new ones
            player.removeAllListeners(AudioPlayerStatus.Idle);
            player.removeAllListeners('error');

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
            // Remove listeners before stopping to prevent double startPlayback()
            const player = this.audioPlayer.getPlayer(guildId);
            if (player) {
                player.removeAllListeners(AudioPlayerStatus.Idle);
                player.removeAllListeners('error');
            }
            this.audioPlayer.stop(guildId);
            this.playbackStates.delete(guildId);
            await this.saveQueue(guildId);
            await this.startPlayback(guildId);
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

        // If paused, use the time we paused at — don't keep counting
        const referenceTime = playbackState.pausedAt || Date.now();
        const elapsed = Math.floor((referenceTime - playbackState.startTime) / 1000);

        // Ensure position doesn't exceed track duration (duration is in ms)
        const current = this.queueManager.getCurrent(guildId);
        if (current && elapsed * 1000 > current.duration) {
            return Math.floor(current.duration / 1000);
        }

        return Math.max(0, elapsed);
    }

    /**
     * Save queue state to database with debouncing to prevent redundant network I/O
     * @param {string} guildId - Guild ID
     * @returns {Promise<void>}
     */
    async saveQueue(guildId) {
        if (!this._saveQueueDebounceTimers) {
            this._saveQueueDebounceTimers = new Map();
        }

        if (this._saveQueueDebounceTimers.has(guildId)) {
            clearTimeout(this._saveQueueDebounceTimers.get(guildId));
        }

        return new Promise((resolve) => {
            const timer = setTimeout(async () => {
                this._saveQueueDebounceTimers.delete(guildId);
                try {
                    await this._executeSaveQueue(guildId);
                } catch (err) {
                    this.log(`Error in debounced saveQueue: ${err.message}`, 'warn');
                }
                resolve();
            }, 1000);

            this._saveQueueDebounceTimers.set(guildId, timer);
        });
    }

    /**
     * Execute actual saveQueue write to database
     * @private
     */
    async _executeSaveQueue(guildId) {
        try {
            const queue = this.queueManager.getQueue(guildId);
            if (!queue || (!queue.current && (!queue.tracks || queue.tracks.length === 0))) {
                return;
            }

            const playbackState = this.playbackStates.get(guildId);
            let currentPosition = 0;
            if (playbackState && (this.audioPlayer.isPlaying(guildId) || this.audioPlayer.isPaused(guildId))) {
                currentPosition = this.getCurrentPosition(guildId);
            }

            const queueData = {
                tracks: queue.tracks,
                current: queue.current,
                currentPosition: currentPosition,
                loopMode: queue.loop,
                volume: queue.volume,
                filter: queue.filter || 'none',
            };

            const db = this.getDatabase();
            if (!db) return;

            const queueDataJson = JSON.stringify(queueData);
            const now = Math.floor(Date.now() / 1000);

            await db.query(
                `INSERT INTO queue_state (guild_id, data_json, updated_at)
                 VALUES (?, ?, ?)
                 ON CONFLICT(guild_id) DO UPDATE SET
                    data_json = excluded.data_json,
                    updated_at = excluded.updated_at`,
                [guildId, queueDataJson, now]
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

            const rows = await db.query(
                `SELECT data_json, updated_at FROM queue_state WHERE guild_id = ?`,
                [guildId]
            );

            const row = rows?.[0];
            if (!row || !row.data_json) return null;

            let queueData;
            try {
                queueData = JSON.parse(row.data_json);
            } catch {
                await this.clearSavedQueue(guildId);
                return null;
            }

            if (!queueData || !Array.isArray(queueData.tracks)) {
                await this.clearSavedQueue(guildId);
                return null;
            }

            return {
                ...queueData,
                currentPosition: queueData.currentPosition || 0,
                loopMode: queueData.loopMode || 'off',
                volume: queueData.volume || 80,
                filter: queueData.filter || 'none',
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

            await db.query('DELETE FROM queue_state WHERE guild_id = ?', [guildId]);
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
            if (!db) return 0;

            const rows = await db.query('SELECT guild_id, data_json FROM queue_state');
            if (!rows || rows.length === 0) return 0;

            let corruptCount = 0;
            for (const row of rows) {
                let isCorrupt = false;
                if (!row.data_json || row.data_json === 'undefined' || row.data_json === 'null') {
                    isCorrupt = true;
                } else {
                    try {
                        const parsed = JSON.parse(row.data_json);
                        if (!parsed || typeof parsed !== 'object') isCorrupt = true;
                    } catch {
                        isCorrupt = true;
                    }
                }

                if (isCorrupt) {
                    await db.query('DELETE FROM queue_state WHERE guild_id = ?', [row.guild_id]);
                    corruptCount++;
                }
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

            const cutoff = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
            const result = await db.query('DELETE FROM queue_state WHERE updated_at < ?', [cutoff]);

            if (result?.changes > 0) {
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
            const ResponseHelper = require('../../../../system/helpers/ResponseHelper');
            const queue = this.getQueue(textChannel.guild.id);
            const durationSecs = track.duration > 10000 ? Math.floor(track.duration / 1000) : (track.duration || 180);

            const embed = ResponseHelper.nowPlayingCard({
                track: {
                    title: track.title,
                    author: track.author || track.uploader || 'Unknown Artist',
                    url: track.url,
                    thumbnail: track.thumbnail,
                    duration: durationSecs,
                    requestedBy: track.requestedBy?.id || track.requestedBy,
                },
                queue: queue || {},
                position: 0,
                isPaused: false,
                loopMode: queue?.loop || 'off',
                volume: queue?.volume || 80,
                filter: queue?.filter || 'none',
            });

            const buttons = ResponseHelper.musicControlsRow({
                isPaused: false,
                loopMode: queue?.loop || 'off',
            });

            await textChannel.send({ embeds: [embed], components: buttons });
        } catch (error) {
            this.handleError(error, 'sendNowPlayingMessage');
        }
    }
}

module.exports = MusicPlayerService;
