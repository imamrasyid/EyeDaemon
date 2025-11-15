/**
 * Music Skip Button Interaction
 * 
 * Skips the current track and plays the next one in queue.
 */

const BaseInteraction = require('../../../../../system/core/BaseInteraction');

class MusicSkipButton extends BaseInteraction {
    constructor(client) {
        super(client, {
            customId: 'music_skip',
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

            // Get current track
            const current = playerService.getCurrent(interaction.guildId);
            if (!current) {
                return await this.sendError(interaction, 'Nothing is currently playing!');
            }

            // Skip track
            playerService.skip(interaction.guildId);

            // Delete the now playing message since track is skipped
            await interaction.update({ content: `⏭️ Skipped **${current.title}**`, embeds: [], components: [] });

            this.log(`Skipped track for guild ${interaction.guild.name}`, 'info', {
                user: interaction.user.tag,
                track: current.title,
            });
        } catch (error) {
            await this.handleError(interaction, error);
        }
    }
}

module.exports = MusicSkipButton;
