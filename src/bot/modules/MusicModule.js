const BaseModule = require('../base/BaseModule');
const { music: logger } = require('../services/logging.service');
const { joinVoiceChannel } = require('@discordjs/voice');
const CONFIG = require('../config');

/**
 * Music Module - Provides music playback functionality
 */
class MusicModule extends BaseModule {
  constructor(client) {
    super(client, {
      name: 'Music',
      description: 'Advanced music playback system with queue management and audio effects',
      version: '1.0.0',
      author: 'EyeDaemon',
      category: 'Entertainment',
      dependencies: ['Database']
    });

    this.queues = new Map();
    this.players = new Map();
    this.connections = new Map();
    this.enabled = CONFIG.FEATURES.MUSIC;
  }

  /**
   * Initialize music module services
   */
  async initializeServices() {
    // Initialize music-specific services here
    logger.info('Music services initialized');
  }

  /**
   * Register music commands
   */
  async registerCommands() {
    logger.info('Music commands managed by CommandHandler');
  }

  /**
   * Register music events
   */
  async registerEvents() {
    // Music-specific events will be registered here
    logger.info('Music events registered');
  }

  /**
   * Register music interactions
   */
  async registerInteractions() {
    // Music button controls, select menus, etc.
    logger.info('Music interactions registered');
  }

  /**
   * Get or create music queue for guild
   * @param {string} guildId - Guild ID
   * @returns {Object} Music queue
   */
  getQueue(guildId) {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, {
        tracks: [],
        current: null,
        volume: CONFIG.AUDIO.VOLUME_DEFAULT,
        loop: false,
        loopQueue: false,
        playing: false,
        paused: false,
        textChannel: null,
        voiceChannel: null,
        connection: null,
        player: null
      });
    }

    return this.queues.get(guildId);
  }

  /**
   * Delete music queue for guild
   * @param {string} guildId - Guild ID
   */
  deleteQueue(guildId) {
    const queue = this.queues.get(guildId);
    if (queue) {
      // Cleanup resources
      if (queue.player) {
        queue.player.stop();
      }
      if (queue.connection) {
        queue.connection.destroy();
      }

      this.queues.delete(guildId);
      logger.debug(`Deleted queue for guild ${guildId}`);
    }
  }

  /**
   * Join voice channel
   * @param {VoiceChannel} voiceChannel - Voice channel to join
   * @param {TextChannel} textChannel - Text channel for responses
   * @returns {Object} Connection info
   */
  async joinVoiceChannel(voiceChannel, textChannel) {
    try {
      const guildId = voiceChannel.guild.id;
      const queue = this.getQueue(guildId);

      // Create voice connection
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: false
      });

      // Store connection info
      queue.connection = connection;
      queue.voiceChannel = voiceChannel;
      queue.textChannel = textChannel;

      // Handle connection events
      connection.on('stateChange', (oldState, newState) => {
        logger.debug(`Voice connection state changed: ${oldState.status} -> ${newState.status}`);
      });

      connection.on('error', (error) => {
        logger.error('Voice connection error', { error: error.message });
        this.deleteQueue(guildId);
      });

      logger.info(`Joined voice channel: ${voiceChannel.name} in ${voiceChannel.guild.name}`);

      return {
        success: true,
        connection,
        queue
      };

    } catch (error) {
      logger.error('Failed to join voice channel', {
        error: error.message,
        channel: voiceChannel.name,
        guild: voiceChannel.guild.name
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Leave voice channel
   * @param {string} guildId - Guild ID
   */
  async leaveVoiceChannel(guildId) {
    try {
      const queue = this.queues.get(guildId);
      if (!queue) {
        return { success: false, error: 'No active queue found' };
      }

      if (queue.connection) {
        queue.connection.destroy();
      }

      this.deleteQueue(guildId);

      logger.info(`Left voice channel in guild ${guildId}`);
      return { success: true };

    } catch (error) {
      logger.error('Failed to leave voice channel', {
        error: error.message,
        guildId
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Add track to queue
   * @param {string} guildId - Guild ID
   * @param {Object} track - Track to add
   */
  addTrack(guildId, track) {
    const queue = this.getQueue(guildId);
    queue.tracks.push(track);
    logger.debug(`Added track to queue: ${track.title} (${guildId})`);
  }

  /**
   * Remove track from queue
   * @param {string} guildId - Guild ID
   * @param {number} index - Track index
   * @returns {Object} Removed track
   */
  removeTrack(guildId, index) {
    const queue = this.getQueue(guildId);

    if (index < 0 || index >= queue.tracks.length) {
      return null;
    }

    const removed = queue.tracks.splice(index, 1)[0];
    logger.debug(`Removed track from queue: ${removed.title} (${guildId})`);

    return removed;
  }

  /**
   * Clear queue
   * @param {string} guildId - Guild ID
   */
  clearQueue(guildId) {
    const queue = this.getQueue(guildId);
    queue.tracks = [];
    logger.debug(`Cleared queue for guild ${guildId}`);
  }

  /**
   * Shuffle queue
   * @param {string} guildId - Guild ID
   */
  shuffleQueue(guildId) {
    const queue = this.getQueue(guildId);

    for (let i = queue.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
    }

    logger.debug(`Shuffled queue for guild ${guildId}`);
  }

  /**
   * Get queue status
   * @param {string} guildId - Guild ID
   * @returns {Object} Queue status
   */
  getQueueStatus(guildId) {
    const queue = this.queues.get(guildId);
    if (!queue) {
      return null;
    }

    return {
      current: queue.current,
      tracks: queue.tracks,
      totalTracks: queue.tracks.length + (queue.current ? 1 : 0),
      volume: queue.volume,
      loop: queue.loop,
      loopQueue: queue.loopQueue,
      playing: queue.playing,
      paused: queue.paused
    };
  }

  /**
   * Set volume
   * @param {string} guildId - Guild ID
   * @param {number} volume - Volume level (0-100)
   * @returns {boolean} Success
   */
  setVolume(guildId, volume) {
    const queue = this.queues.get(guildId);
    if (!queue) {
      return false;
    }

    // Clamp volume to valid range
    volume = Math.max(0, Math.min(100, volume));
    queue.volume = volume;

    // Apply volume to player if active
    if (queue.player) {
      // Volume adjustment would be implemented here based on audio library
    }

    logger.debug(`Set volume to ${volume} for guild ${guildId}`);
    return true;
  }

  /**
   * Toggle loop modes
   * @param {string} guildId - Guild ID
   * @returns {Object} New loop state
   */
  toggleLoop(guildId) {
    const queue = this.queues.get(guildId);
    if (!queue) {
      return null;
    }

    if (!queue.loop && !queue.loopQueue) {
      queue.loop = true;
      queue.loopQueue = false;
    } else if (queue.loop && !queue.loopQueue) {
      queue.loop = false;
      queue.loopQueue = true;
    } else {
      queue.loop = false;
      queue.loopQueue = false;
    }

    logger.debug(`Toggled loop: track=${queue.loop}, queue=${queue.loopQueue} (${guildId})`);

    return {
      track: queue.loop,
      queue: queue.loopQueue
    };
  }

  /**
   * Module cleanup
   */
  async onShutdown() {
    logger.info('Shutting down music module');

    // Cleanup all queues
    for (const guildId of this.queues.keys()) {
      await this.leaveVoiceChannel(guildId);
    }

    this.queues.clear();
    this.players.clear();
    this.connections.clear();

    logger.info('Music module shutdown complete');
  }

  /**
   * Get module statistics
   */
  getStats() {
    return {
      activeQueues: this.queues.size,
      activeConnections: this.connections.size,
      totalTracksPlayed: 0 // Would be tracked in a real implementation
    };
  }
}

module.exports = MusicModule;
