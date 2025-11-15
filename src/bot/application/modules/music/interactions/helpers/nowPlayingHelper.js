/**
 * Now Playing Helper
 * 
 * Shared helper functions for updating now playing messages in button interactions
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatDuration } = require('../../../../../system/helpers/format_helper');

/**
 * Update now playing message with current state
 * @param {Object} interaction - Discord interaction
 * @param {Object} playerService - MusicPlayerService instance
 */
async function updateNowPlayingMessage(interaction, playerService) {
    const current = playerService.getCurrent(interaction.guildId);
    const queue = playerService.getQueue(interaction.guildId);

    if (!current) {
        return await interaction.update({ content: '❌ Nothing is currently playing', components: [] });
    }

    // Get current position
    let currentPosition = null;
    if (playerService.isPlaying(interaction.guildId)) {
        currentPosition = playerService.getCurrentPosition(interaction.guildId);
    }

    // Create updated embed
    const embed = createNowPlayingEmbed(current, queue, currentPosition);

    // Create updated buttons
    const buttons = createMusicControlButtons(interaction.guildId, playerService, queue);

    await interaction.update({ embeds: [embed], components: [buttons] });
}

/**
 * Create now playing embed
 * @param {Object} track - Track object
 * @param {Object} queue - Queue object
 * @param {number} currentPosition - Current position in seconds
 * @returns {EmbedBuilder} Discord embed
 */
function createNowPlayingEmbed(track, queue, currentPosition) {
    const embed = new EmbedBuilder()
        .setColor(0x00b894)
        .setTitle('🎶 Now Playing')
        .setDescription(`[${track.title}](${track.url})`);

    // Add duration and position info
    if (currentPosition !== null && currentPosition >= 0) {
        const currentMs = currentPosition * 1000;
        const progress = createProgressBar(currentMs, track.duration * 1000, 20);
        embed.addFields({
            name: 'Progress',
            value: `${formatDuration(currentMs)} ${progress} ${formatDuration(track.duration * 1000)}`,
            inline: false
        });
    } else {
        embed.addFields({ name: 'Duration', value: formatDuration(track.duration * 1000), inline: true });
    }

    embed.addFields({ name: 'Requested By', value: `<@${track.requestedBy.id}>`, inline: true });

    if (track.thumbnail) {
        embed.setThumbnail(track.thumbnail);
    }

    // Add settings
    const loopEmoji = { 'off': '➡️', 'track': '🔂', 'queue': '🔁' };
    const filterEmoji = { 'none': '🎵', 'bassboost': '🔊', 'nightcore': '⚡', 'vaporwave': '🌊', '8d': '🎧', 'karaoke': '🎤' };
    const currentFilter = queue.filter || 'none';
    const filterName = currentFilter === 'none' ? 'None' : currentFilter.charAt(0).toUpperCase() + currentFilter.slice(1);

    embed.addFields({
        name: '⚙️ Settings',
        value: `Loop: ${loopEmoji[queue.loop]} ${queue.loop} | Volume: 🔊 ${queue.volume}% | Filter: ${filterEmoji[currentFilter]} ${filterName}`,
    });

    // Add next tracks
    if (queue.tracks.length > 0) {
        const nextTracks = queue.tracks.slice(0, 3).map((t, i) => `**${i + 1}.** ${t.title}`).join('\n');
        embed.addFields({ name: `📋 Up Next (${queue.tracks.length} in queue)`, value: nextTracks });
    }

    embed.setTimestamp();
    return embed;
}

/**
 * Create progress bar
 * @param {number} current - Current position in milliseconds
 * @param {number} total - Total duration in milliseconds
 * @param {number} length - Length of progress bar
 * @returns {string} Progress bar string
 */
function createProgressBar(current, total, length = 20) {
    const progress = Math.min(Math.max(current / total, 0), 1);
    const filledLength = Math.round(length * progress);
    const emptyLength = length - filledLength;
    return '▬'.repeat(filledLength) + '🔘' + '▬'.repeat(emptyLength);
}

/**
 * Create music control buttons
 * @param {string} guildId - Guild ID
 * @param {Object} playerService - MusicPlayerService instance
 * @param {Object} queue - Queue object
 * @returns {ActionRowBuilder} Action row with control buttons
 */
function createMusicControlButtons(guildId, playerService, queue) {
    const isPaused = playerService.isPaused(guildId);
    const loopMode = queue.loop || 'off';

    const playPauseEmoji = isPaused ? '▶️' : '⏸️';
    const playPauseStyle = isPaused ? ButtonStyle.Success : ButtonStyle.Secondary;

    let loopStyle = ButtonStyle.Secondary;
    let loopEmoji = '➡️';
    if (loopMode === 'track') {
        loopStyle = ButtonStyle.Primary;
        loopEmoji = '🔂';
    } else if (loopMode === 'queue') {
        loopStyle = ButtonStyle.Primary;
        loopEmoji = '🔁';
    }

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music_play_pause').setEmoji(playPauseEmoji).setStyle(playPauseStyle),
        new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('music_loop').setEmoji(loopEmoji).setStyle(loopStyle),
        new ButtonBuilder().setCustomId('music_volume_down').setEmoji('🔉').setStyle(ButtonStyle.Secondary)
    );
}

module.exports = {
    updateNowPlayingMessage,
    createNowPlayingEmbed,
    createProgressBar,
    createMusicControlButtons,
};
