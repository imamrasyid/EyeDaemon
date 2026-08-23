/**
 * Music Stop Button Interaction
 * 
 * Stops playback and clears the queue with ResponseHelper.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');
const ResponseHelper = require('../../../../../system/helpers/ResponseHelper');

class MusicStopButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'music_stop',
            type: 'button',
        });
    }

    async execute(interaction) {
        try {
            if (!interaction.member?.voice?.channel) {
                return await this.sendError(interaction, 'You need to be in a voice channel to use this button!');
            }

            if (!this.isInSameVoiceChannel(interaction)) {
                return await this.sendError(interaction, 'You need to be in the same voice channel as the bot!');
            }

            const musicModule = this.client.modules.get('music');
            const playerService = musicModule.getService('MusicPlayerService');

            if (!playerService.isConnected(interaction.guildId)) {
                return await this.sendError(interaction, 'Bot is not connected to a voice channel!');
            }

            await playerService.stop(interaction.guildId);

            const embed = ResponseHelper.info(
                'Music Playback Stopped',
                `Audio playback has been stopped and queue was cleared by ${interaction.user}.`
            );

            await interaction.update({ embeds: [embed], components: [] });

            this.log(`Stopped playback for guild ${interaction.guild.name}`, 'info', {
                user: interaction.user.tag,
            });
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }
}

module.exports = MusicStopButton;
