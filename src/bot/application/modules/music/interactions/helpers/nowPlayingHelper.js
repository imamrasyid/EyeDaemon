/**
 * Now Playing Helper
 * 
 * Shared helper functions for updating now playing messages in button interactions with ResponseHelper.
 */

const ResponseHelper = require('../../../../../system/helpers/ResponseHelper');

/**
 * Update now playing message with current state
 * @param {Object} interaction - Discord interaction
 * @param {Object} playerService - MusicPlayerService instance
 */
async function updateNowPlayingMessage(interaction, playerService) {
    const current = playerService.getCurrent(interaction.guildId);
    const queue = playerService.getQueue(interaction.guildId);

    if (!current) {
        const payload = { content: '❌ Nothing is currently playing', embeds: [], components: [] };
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(payload).catch(() => {});
        } else {
            return await interaction.update(payload).catch(() => {});
        }
    }

    // Get current position
    let currentPosition = 0;
    if (playerService.isPlaying(interaction.guildId)) {
        currentPosition = playerService.getCurrentPosition(interaction.guildId) || 0;
    }

    // Create updated embed using ResponseHelper
    const durationSecs = current.duration > 10000 ? Math.floor(current.duration / 1000) : (current.duration || 180);
    const positionSecs = currentPosition > 10000 ? Math.floor(currentPosition / 1000) : currentPosition;

    const embed = ResponseHelper.nowPlayingCard({
        track: {
            title: current.title,
            author: current.author || current.uploader || 'Unknown Artist',
            url: current.url,
            thumbnail: current.thumbnail,
            duration: durationSecs,
            requestedBy: current.requestedBy?.id || current.requestedBy,
        },
        queue,
        position: positionSecs,
        isPaused: playerService.isPaused(interaction.guildId),
        loopMode: queue?.loop || 'off',
        volume: playerService.getVolume ? playerService.getVolume(interaction.guildId) : (queue?.volume || 80),
        filter: queue?.filter || 'none',
    });

    // Create updated buttons using ResponseHelper
    const buttons = ResponseHelper.musicControlsRow({
        isPaused: playerService.isPaused(interaction.guildId),
        loopMode: queue?.loop || 'off',
    });

    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [embed], components: buttons });
        } else {
            await interaction.update({ embeds: [embed], components: buttons });
        }
    } catch (err) {
        // Safely suppress expired token errors
        if (err.code !== 10062 && !err.message?.includes('Unknown interaction')) {
            throw err;
        }
    }
}

module.exports = {
    updateNowPlayingMessage,
};
