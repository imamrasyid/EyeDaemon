/**
 * Music Volume Down Button Interaction
 * 
 * Decreases volume by 10%.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const { updateNowPlayingMessage } = require('../helpers/nowPlayingHelper');

class MusicVolumeDownButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'music_volume_down',
            type: 'button',
        });
    }

    async execute(interaction) {
        try {
            // Validate user is in voice channel
            if (!interaction.member?.voice?.channel) {
                return await this.sendError(interaction, 'You need to be in a voice channel to use this button!');
            }

            // Validate bot is in same voice channel
            if (!this.isInSameVoiceChannel(interaction)) {
                return await this.sendError(interaction, 'You need to be in the same voice channel as the bot!');
            }

            // Get MusicPlayerService
            const musicModule = this.client.modules.get('music');
            const playerService = musicModule.getService('MusicPlayerService');

            // Check if bot is connected
            if (!playerService.isConnected(interaction.guildId)) {
                return await this.sendError(interaction, 'Bot is not connected to a voice channel!');
            }

            // Get current volume
            const queue = playerService.getQueue(interaction.guildId);
            const currentVolume = queue.volume || 80;

            // Calculate new volume (min 0)
            const newVolume = Math.max(0, currentVolume - 10);

            if (newVolume === currentVolume) {
                return await this.sendError(interaction, 'Volume is already at minimum (0%)!');
            }

            // Set new volume
            await playerService.setVolume(interaction.guildId, newVolume);

            // Update the message with new volume
            await updateNowPlayingMessage(interaction, playerService);

            this.log(`Decreased volume for guild ${interaction.guild.name}`, 'info', {
                user: interaction.user.tag,
                from: currentVolume,
                to: newVolume,
            });
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }
}

module.exports = MusicVolumeDownButton;
