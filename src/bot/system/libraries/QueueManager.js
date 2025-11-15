/**
 * QueueManager Library
 * Manages music queues for all guilds
 * Handles queue operations and loop modes
 */
class QueueManager {
    constructor(instance, params = {}) {
        this.instance = instance;
        this.queues = new Map();
    }

    /**
     * Get or create queue for a guild
     * @param {string} guildId - The guild ID
     * @returns {Object} The queue object
     */
    getQueue(guildId) {
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, {
                tracks: [],
                current: null,
                loop: 'off', // 'off', 'track', 'queue'
                volume: 80,
                filter: 'none', // 'none', 'bassboost', 'nightcore', 'vaporwave', '8d', 'karaoke'
                history: [],
            });
        }
        return this.queues.get(guildId);
    }

    /**
     * Add track to queue
     * @param {string} guildId - The guild ID
     * @param {Object} track - The track object
     * @returns {number} Position in queue
     */
    add(guildId, track) {
        const queue = this.getQueue(guildId);
        queue.tracks.push(track);
        return queue.tracks.length;
    }

    /**
     * Add multiple tracks to queue
     * @param {string} guildId - The guild ID
     * @param {Array} tracks - Array of track objects
     * @returns {number} Number of tracks added
     */
    addMultiple(guildId, tracks) {
        const queue = this.getQueue(guildId);
        queue.tracks.push(...tracks);
        return tracks.length;
    }

    /**
     * Get next track from queue
     * Handles loop modes
     * @param {string} guildId - The guild ID
     * @returns {Object|null} Next track or null
     */
    next(guildId) {
        const queue = this.getQueue(guildId);

        // Handle track loop
        if (queue.loop === 'track' && queue.current) {
            return queue.current;
        }

        // Add current to history
        if (queue.current) {
            queue.history.push(queue.current);
            // Keep history limited to last 50 tracks
            if (queue.history.length > 50) {
                queue.history.shift();
            }
        }

        // Handle queue loop
        if (queue.loop === 'queue' && queue.current) {
            queue.tracks.push(queue.current);
        }

        // Get next track
        const next = queue.tracks.shift();
        queue.current = next || null;
        return queue.current;
    }

    /**
     * Skip to specific position in queue
     * @param {string} guildId - The guild ID
     * @param {number} position - Position to skip to (1-based)
     * @returns {Object|null} The track at position or null
     */
    skipTo(guildId, position) {
        const queue = this.getQueue(guildId);

        if (position < 1 || position > queue.tracks.length) {
            return null;
        }

        // Remove tracks before position
        const skipped = queue.tracks.splice(0, position - 1);

        // Add current to history
        if (queue.current) {
            queue.history.push(queue.current);
        }

        // Get track at position
        const track = queue.tracks.shift();
        queue.current = track || null;

        return queue.current;
    }

    /**
     * Clear queue
     * @param {string} guildId - The guild ID
     */
    clear(guildId) {
        const queue = this.getQueue(guildId);
        queue.tracks = [];
        queue.current = null;
    }

    /**
     * Remove track at position
     * @param {string} guildId - The guild ID
     * @param {number} position - Position to remove (1-based)
     * @returns {Object|null} Removed track or null
     */
    remove(guildId, position) {
        const queue = this.getQueue(guildId);

        if (position < 1 || position > queue.tracks.length) {
            return null;
        }

        const removed = queue.tracks.splice(position - 1, 1);
        return removed[0] || null;
    }

    /**
     * Shuffle queue
     * @param {string} guildId - The guild ID
     */
    shuffle(guildId) {
        const queue = this.getQueue(guildId);

        // Fisher-Yates shuffle
        for (let i = queue.tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
        }
    }

    /**
     * Set loop mode
     * @param {string} guildId - The guild ID
     * @param {string} mode - Loop mode ('off', 'track', 'queue')
     * @returns {boolean} True if mode set successfully
     */
    setLoop(guildId, mode) {
        const validModes = ['off', 'track', 'queue'];
        if (!validModes.includes(mode)) {
            return false;
        }

        const queue = this.getQueue(guildId);
        queue.loop = mode;
        return true;
    }

    /**
     * Get loop mode
     * @param {string} guildId - The guild ID
     * @returns {string} Current loop mode
     */
    getLoop(guildId) {
        const queue = this.getQueue(guildId);
        return queue.loop;
    }

    /**
     * Set volume
     * @param {string} guildId - The guild ID
     * @param {number} volume - Volume level (0-100)
     * @returns {boolean} True if volume set successfully
     */
    setVolume(guildId, volume) {
        const queue = this.getQueue(guildId);
        const volumeLevel = Math.max(0, Math.min(100, volume));
        queue.volume = volumeLevel;
        return true;
    }

    /**
     * Get volume
     * @param {string} guildId - The guild ID
     * @returns {number} Current volume level
     */
    getVolume(guildId) {
        const queue = this.getQueue(guildId);
        return queue.volume;
    }

    /**
     * Set audio filter
     * @param {string} guildId - The guild ID
     * @param {string} filter - Filter type ('none', 'bassboost', 'nightcore', 'vaporwave', '8d', 'karaoke')
     * @returns {boolean} True if filter set successfully
     */
    setFilter(guildId, filter) {
        const validFilters = ['none', 'bassboost', 'nightcore', 'vaporwave', '8d', 'karaoke'];
        if (!validFilters.includes(filter)) {
            return false;
        }

        const queue = this.getQueue(guildId);
        queue.filter = filter;
        return true;
    }

    /**
     * Get audio filter
     * @param {string} guildId - The guild ID
     * @returns {string} Current filter
     */
    getFilter(guildId) {
        const queue = this.getQueue(guildId);
        return queue.filter || 'none';
    }

    /**
     * Get current track
     * @param {string} guildId - The guild ID
     * @returns {Object|null} Current track or null
     */
    getCurrent(guildId) {
        const queue = this.getQueue(guildId);
        return queue.current;
    }

    /**
     * Get all tracks in queue
     * @param {string} guildId - The guild ID
     * @returns {Array} Array of tracks
     */
    getTracks(guildId) {
        const queue = this.getQueue(guildId);
        return queue.tracks;
    }

    /**
     * Get queue size
     * @param {string} guildId - The guild ID
     * @returns {number} Number of tracks in queue
     */
    getSize(guildId) {
        const queue = this.getQueue(guildId);
        return queue.tracks.length;
    }

    /**
     * Check if queue is empty
     * @param {string} guildId - The guild ID
     * @returns {boolean} True if queue is empty
     */
    isEmpty(guildId) {
        const queue = this.getQueue(guildId);
        return queue.tracks.length === 0 && queue.current === null;
    }

    /**
     * Get previous track from history
     * @param {string} guildId - The guild ID
     * @returns {Object|null} Previous track or null
     */
    getPrevious(guildId) {
        const queue = this.getQueue(guildId);
        if (queue.history.length === 0) {
            return null;
        }
        return queue.history[queue.history.length - 1];
    }

    /**
     * Move track to different position
     * @param {string} guildId - The guild ID
     * @param {number} from - Current position (1-based)
     * @param {number} to - Target position (1-based)
     * @returns {boolean} True if moved successfully
     */
    move(guildId, from, to) {
        const queue = this.getQueue(guildId);

        if (from < 1 || from > queue.tracks.length || to < 1 || to > queue.tracks.length) {
            return false;
        }

        const track = queue.tracks.splice(from - 1, 1)[0];
        queue.tracks.splice(to - 1, 0, track);
        return true;
    }

    /**
     * Get total duration of queue
     * @param {string} guildId - The guild ID
     * @returns {number} Total duration in milliseconds
     */
    getTotalDuration(guildId) {
        const queue = this.getQueue(guildId);
        let total = 0;

        if (queue.current && queue.current.duration) {
            total += queue.current.duration;
        }

        for (const track of queue.tracks) {
            if (track.duration) {
                total += track.duration;
            }
        }

        return total;
    }

    /**
     * Remove queue for a guild
     * @param {string} guildId - The guild ID
     */
    removeQueue(guildId) {
        this.queues.delete(guildId);
    }

    /**
     * Cleanup all queues
     * Used during bot shutdown
     */
    cleanup() {
        this.queues.clear();
    }
}

module.exports = QueueManager;
