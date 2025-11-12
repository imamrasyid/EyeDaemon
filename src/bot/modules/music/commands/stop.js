const { BaseCommand } = require('../../../base/BaseCommand');
const { music: logger } = require('../../../services/logging.service');

/**
 * Stop command - Stop music playback and clear queue
 */
class StopCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'stop',
      description: 'Stop music playback and clear the queue',
      category: 'Music',
      usage: '',
      aliases: ['disconnect', 'leave'],
      cooldown: 3000,
      args: false,
      guildOnly: true,
      botPermissions: ['Connect', 'Speak']
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
        return message.reply(this.formatError('You need to be in a voice channel to use this command!'));
      }

      // Get queue
      const queue = musicModule.getQueue(message.guild.id);
      if (!queue || !queue.connection) {
        return message.reply(this.formatError('There is no active music session to stop.'));
      }

      // Check if bot is in same voice channel
      if (queue.voiceChannel && queue.voiceChannel.id !== voiceChannel.id) {
        return message.reply(this.formatError('You need to be in the same voice channel as the bot!'));
      }

      // Stop playback and leave
      const result = await musicModule.leaveVoiceChannel(message.guild.id);
      
      if (result.success) {
        await message.reply({
          embeds: [{
            color: 0xff0000,
            title: '⏹️ Music Stopped',
            description: 'Music playback has been stopped and the queue has been cleared.',
            timestamp: new Date()
          }]
        });

        logger.info(`Music stopped in guild: ${message.guild.name}`);
      } else {
        await message.reply(this.formatError(`Failed to stop music: ${result.error}`));
      }

    } catch (error) {
      logger.error('Error in stop command', { 
        error: error.message,
        user: message.author.tag,
        guild: message.guild.name
      });
      
      await message.reply(this.formatError('An error occurred while trying to stop music.'));
    }
  }
}

module.exports = StopCommand;