const { BaseCommand } = require('../../../base/BaseCommand');
const { music: logger } = require('../../../services/logging.service');
const { joinVoiceChannel } = require('@discordjs/voice');

/**
 * Play command - Play music from various sources
 */
class PlayCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'play',
      description: 'Play music from YouTube, Spotify, or SoundCloud',
      category: 'Music',
      usage: '<song/url>',
      aliases: ['p', 'sing'],
      cooldown: 3000,
      args: true,
      minArgs: 1,
      botPermissions: ['Connect', 'Speak'],
      guildOnly: true
    });
  }

  async execute(message, args) {
    try {
      // Get music module
      const musicModule = this.client.getModule('Music');
      if (!musicModule) {
        return message.reply(this.formatError('Music module is not available.'));
      }

      // Check if user is in voice channel
      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel) {
        return message.reply(this.formatError('You need to be in a voice channel to play music!'));
      }

      // Check bot permissions
      const permissions = voiceChannel.permissionsFor(message.guild.members.me);
      if (!permissions.has('Connect') || !permissions.has('Speak')) {
        return message.reply(this.formatError('I need permission to connect and speak in voice channels!'));
      }

      // Get search query
      const query = args.join(' ');
      
      // Search for track (simplified implementation)
      const track = await this.searchTrack(query);
      if (!track) {
        return message.reply(this.formatError(`No results found for "${query}". Please try a different search term.`));
      }

      // Get or create queue
      const queue = musicModule.getQueue(message.guild.id);
      
      // Join voice channel if not already connected
      if (!queue.connection) {
        const result = await musicModule.joinVoiceChannel(voiceChannel, message.channel);
        if (!result.success) {
          return message.reply(this.formatError(`Failed to join voice channel: ${result.error}`));
        }
      }

      // Add track to queue
      musicModule.addTrack(message.guild.id, track);

      // Send confirmation
      const embed = {
        color: 0x00ff00,
        title: '🎵 Added to Queue',
        description: `**[${track.title}](${track.url})**`,
        fields: [
          {
            name: 'Duration',
            value: track.duration || 'Unknown',
            inline: true
          },
          {
            name: 'Requested by',
            value: message.author.tag,
            inline: true
          }
        ],
        thumbnail: {
          url: track.thumbnail
        },
        footer: {
          text: `Queue position: ${queue.tracks.length}`
        },
        timestamp: new Date()
      };

      await message.reply({ embeds: [embed] });

      // Start playing if queue was empty
      if (!queue.playing && queue.tracks.length === 1) {
        await this.startPlaying(message.guild.id, track);
      }

      logger.info(`Added track to queue: ${track.title} in ${message.guild.name}`);

    } catch (error) {
      logger.error('Error in play command', { 
        error: error.message,
        user: message.author.tag,
        guild: message.guild.name,
        query: args.join(' ')
      });
      
      await message.reply(this.formatError('An error occurred while trying to play music.'));
    }
  }

  /**
   * Search for track (simplified implementation)
   * @param {string} query - Search query
   * @returns {Object|null} Track information
   */
  async searchTrack(query) {
    // This is a simplified implementation
    // In a real implementation, you would use YouTube API, Spotify API, etc.
    
    // Check if it's a URL
    if (this.isURL(query)) {
      return {
        title: `Track from ${this.getPlatformFromURL(query)}`,
        url: query,
        duration: '3:30',
        thumbnail: 'https://via.placeholder.com/150',
        platform: this.getPlatformFromURL(query),
        requestedBy: null
      };
    }

    // Simulate search results
    const mockTracks = [
      {
        title: `${query} - Official Music Video`,
        url: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`,
        duration: '3:32',
        thumbnail: 'https://via.placeholder.com/150',
        platform: 'youtube',
        requestedBy: null
      },
      {
        title: `${query} - Audio`,
        url: `https://soundcloud.com/example/track`,
        duration: '4:15',
        thumbnail: 'https://via.placeholder.com/150',
        platform: 'soundcloud',
        requestedBy: null
      }
    ];

    // Return first result for now
    return mockTracks[0];
  }

  /**
   * Check if string is URL
   * @param {string} str - String to check
   * @returns {boolean}
   */
  isURL(str) {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get platform from URL
   * @param {string} url - URL to check
   * @returns {string} Platform name
   */
  getPlatformFromURL(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'YouTube';
    } else if (url.includes('spotify.com')) {
      return 'Spotify';
    } else if (url.includes('soundcloud.com')) {
      return 'SoundCloud';
    } else {
      return 'Unknown';
    }
  }

  /**
   * Start playing track (simplified implementation)
   * @param {string} guildId - Guild ID
   * @param {Object} track - Track to play
   */
  async startPlaying(guildId, track) {
    const musicModule = this.client.getModule('Music');
    const queue = musicModule.getQueue(guildId);
    
    queue.current = track;
    queue.playing = true;

    // Simulate playing (in real implementation, this would use audio libraries)
    logger.info(`Started playing: ${track.title} in guild ${guildId}`);

    // Simulate track end (for demo purposes)
    setTimeout(() => {
      this.handleTrackEnd(guildId);
    }, 10000); // 10 seconds for demo
  }

  /**
   * Handle track end
   * @param {string} guildId - Guild ID
   */
  async handleTrackEnd(guildId) {
    const musicModule = this.client.getModule('Music');
    const queue = musicModule.getQueue(guildId);
    
    if (!queue) return;

    queue.playing = false;
    queue.current = null;

    // Check if there are more tracks in queue
    if (queue.tracks.length > 0) {
      const nextTrack = queue.tracks.shift();
      await this.startPlaying(guildId, nextTrack);
    } else if (queue.loop && queue.current) {
      // Loop current track
      await this.startPlaying(guildId, queue.current);
    } else if (queue.loopQueue && queue.current) {
      // Add current track back to end of queue
      queue.tracks.push(queue.current);
      if (queue.tracks.length > 0) {
        const nextTrack = queue.tracks.shift();
        await this.startPlaying(guildId, nextTrack);
      }
    } else {
      // Leave voice channel after timeout
      setTimeout(() => {
        musicModule.leaveVoiceChannel(guildId);
      }, 30000); // 30 seconds
    }
  }
}

module.exports = PlayCommand;