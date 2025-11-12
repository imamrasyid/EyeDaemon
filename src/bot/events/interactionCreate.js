const { BaseDiscordEvent } = require('../base/BaseEvent');
const { events: logger } = require('../services/logging.service');

class InteractionCreateEvent extends BaseDiscordEvent {
  constructor(client) {
    super(client, {
      name: 'interactionCreate',
      eventName: 'interactionCreate',
      description: 'Menangani semua interaction, termasuk slash command dan komponen UI',
      once: false
    });
  }

  async execute(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        if (this.client.commandHandler && typeof this.client.commandHandler.handleSlashCommand === 'function') {
          await this.client.commandHandler.handleSlashCommand(interaction);
          return;
        }
        logger.warn('handleSlashCommand tidak tersedia di CommandHandler');
        return;
      }

      if (this.client.interactionHandler) {
        await this.client.interactionHandler.handleInteraction(interaction);
      }
    } catch (error) {
      logger.error('Error di interactionCreate', { error: error.message });
      try {
        if (interaction.isRepliable()) {
          await interaction.reply({
            embeds: [{
              color: 0xff0000,
              title: '❌ Interaction Error',
              description: 'Terjadi kesalahan saat memproses interaksi ini.',
              timestamp: new Date()
            }],
            ephemeral: true
          });
        }
      } catch {}
    }
  }
}

module.exports = InteractionCreateEvent;