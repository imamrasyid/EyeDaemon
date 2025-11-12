const { BaseCommand } = require('../../../base/BaseCommand');
const { music: logger } = require('../../../services/logging.service');

/**
 * Queue command - Display current music queue
 */
class QueueCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'queue',
      description: 'Display the current music queue',
      category: 'Music',
      usage: '[page]',
      aliases: ['q', 'list'],
      cooldown: 3000,
      args: false,
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

      // Get queue status
      const queueStatus = musicModule.getQueueStatus(message.guild.id);
      if (!queueStatus || queueStatus.totalTracks === 0) {
        return message.reply({
          embeds: [{
            color: 0xffa500,
            title: '📄 Empty Queue',
            description: 'The queue is currently empty. Use `!play <song>` to add some music!',
            timestamp: new Date()
          }]
        });
      }

      // Parse page number
      const page = args.length > 0 ? parseInt(args[0]) || 1 : 1;
      const itemsPerPage = 10;
      const totalPages = Math.ceil(queueStatus.tracks.length / itemsPerPage);
      const currentPage = Math.max(1, Math.min(page, totalPages));

      // Build queue embed
      const embed = {
        color: 0x3498db,
        title: '📋 Music Queue',
        fields: [],
        footer: {
          text: `Page ${currentPage}/${totalPages} • ${queueStatus.tracks.length} tracks in queue`
        },
        timestamp: new Date()
      };

      // Add current track info
      if (queueStatus.current) {
        embed.fields.push({
          name: '**🎵 Now Playing**',
          value: `**${queueStatus.current.title}**\nDuration: ${queueStatus.current.duration}`,
          inline: false
        });
      }

      // Add queue tracks for current page
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const pageTracks = queueStatus.tracks.slice(startIndex, endIndex);

      if (pageTracks.length > 0) {
        const queueText = pageTracks.map((track, index) => {
          const position = startIndex + index + 1;
          return `\`${position}.\` ${track.title} (${track.duration})`;
        }).join('\n');

        embed.fields.push({
          name: `**📄 Up Next**`,
          value: queueText,
          inline: false
        });
      }

      // Add queue status
      const statusInfo = [];
      if (queueStatus.loop) statusInfo.push('🔂 Track Loop');
      if (queueStatus.loopQueue) statusInfo.push('🔁 Queue Loop');
      if (queueStatus.volume !== 50) statusInfo.push(`🔊 Volume: ${queueStatus.volume}%`);

      if (statusInfo.length > 0) {
        embed.fields.push({
          name: '**⚙️ Status**',
          value: statusInfo.join(' • '),
          inline: false
        });
      }

      await message.reply({ embeds: [embed] });

      logger.debug(`Displayed queue for ${message.guild.name} (page ${currentPage})`);

    } catch (error) {
      logger.error('Error in queue command', { 
        error: error.message,
        user: message.author.tag,
        guild: message.guild.name
      });
      
      await message.reply(this.formatError('An error occurred while displaying the queue.'));
    }
  }
}

module.exports = QueueCommand;