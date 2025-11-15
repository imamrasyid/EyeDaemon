/**
 * Music Loop Button Interaction
 * 
 * Cycles through loop modes: off -> track -> queue -> off
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const { updateNowPlayingMessage } = require('../helpers/nowPlayingHelper');

class MusicLoopButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'music_loop',
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

            // Get current loop mode
            const queue = playerService.getQueue(interaction.guildId);
            const currentMode = queue.loop || 'off';

            // Cycle to next mode
            const modes = ['off', 'track', 'queue'];
            const currentIndex = modes.indexOf(currentMode);
            const nextMode = modes[(currentIndex + 1) % modes.length];

            // Set new loop mode
            await playerService.setLoop(interaction.guildId, nextMode);

            // Update the message with new button states
            await updateNowPlayingMessage(interaction, playerService);

            this.log(`Changed loop mode for guild ${interaction.guild.name}`, 'info', {
                user: interaction.user.tag,
                from: currentMode,
                to: nextMode,
            });
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }
}

module.exports = MusicLoopButton;
