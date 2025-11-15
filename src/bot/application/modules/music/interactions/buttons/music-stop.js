/**
 * Music Stop Button Interaction
 * 
 * Stops playback and clears the queue.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');

class MusicStopButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'music_stop',
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

            // Stop playback
            await playerService.stop(interaction.guildId);

            // Update message to show stopped state
            await interaction.update({ content: '⏹️ Playback stopped and queue cleared', embeds: [], components: [] });

            this.log(`Stopped playback for guild ${interaction.guild.name}`, 'info', {
                user: interaction.user.tag,
            });
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }
}

module.exports = MusicStopButton;
