/**
 * Music Play/Pause Button Interaction
 * 
 * Toggles playback between play and pause states.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const { updateNowPlayingMessage } = require('../helpers/nowPlayingHelper');

class MusicPlayPauseButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'music_play_pause',
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

            // Toggle play/pause
            const isPaused = playerService.isPaused(interaction.guildId);
            const isPlaying = playerService.isPlaying(interaction.guildId);

            if (!isPaused && !isPlaying) {
                return await this.sendError(interaction, 'Nothing is currently playing!');
            }

            if (isPaused) {
                playerService.resume(interaction.guildId);
            } else {
                playerService.pause(interaction.guildId);
            }

            // Update the message with new button states
            await updateNowPlayingMessage(interaction, playerService);

            this.log(`Toggled playback for guild ${interaction.guild.name}`, 'info', {
                user: interaction.user.tag,
                action: isPaused ? 'resume' : 'pause',
            });
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }
}

module.exports = MusicPlayPauseButton;
