/**
 * MusicEmbedBuilder
 * 
 * Helper class for creating music-related embeds
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class MusicEmbedBuilder {
    constructor(controller) {
        this.controller = controller;
    }

    /**
     * Create embed for now playing display
     * @param {Object} track - Current track
     * @param {Object} queue - Queue object
     * @param {number} currentPosition - Current position in seconds (optional)
     * @returns {EmbedBuilder} Discord embed
     */
    createNowPlayingEmbed(track, queue, currentPosition = null) {
        const embed = new EmbedBuilder()
            .setColor(0x00b894)
            .setTitle('🎶 Now Playing')
            .setDescription(`[${track.title}](${track.url})`);

        // Add duration and position info
        if (currentPosition !== null && currentPosition >= 0) {
            // Convert seconds to milliseconds for formatDuration and progressBar
            const currentMs = currentPosition * 1000;
            const progress = this.controller.progressBar(currentMs, track.duration, 20);
            embed.addFields(
                {
                    name: 'Progress',
                    value: `${this.controller.formatDuration(currentMs)} ${progress} ${this.controller.formatDuration(track.duration)}`,
                    inline: false
                }
            );
        } else {
            embed.addFields(
                { name: 'Duration', value: this.controller.formatDuration(track.duration), inline: true }
            );
        }

        embed.addFields(
            { name: 'Requested By', value: `<@${track.requestedBy.id}>`, inline: true }
        );

        if (track.thumbnail) {
            embed.setThumbnail(track.thumbnail);
        }

        // Add queue info
        const loopEmoji = {
            'off': '➡️',
            'track': '🔂',
            'queue': '🔁'
        };

        const filterEmoji = {
            'none': '🎵',
            'bassboost': '🔊',
            'nightcore': '⚡',
            'vaporwave': '🌊',
            '8d': '🎧',
            'karaoke': '🎤'
        };

        const currentFilter = queue.filter || 'none';
        const filterName = currentFilter === 'none' ? 'None' : currentFilter.charAt(0).toUpperCase() + currentFilter.slice(1);

        embed.addFields({
            name: '⚙️ Settings',
            value: `Loop: ${loopEmoji[queue.loop]} ${queue.loop} | Volume: 🔊 ${queue.volume}% | Filter: ${filterEmoji[currentFilter]} ${filterName}`,
        });

        // Add next tracks
        if (queue.tracks.length > 0) {
            const nextTracks = queue.tracks
                .slice(0, 3)
                .map((t, i) => `**${i + 1}.** ${t.title}`)
                .join('\n');

            embed.addFields({
                name: `📋 Up Next (${queue.tracks.length} in queue)`,
                value: nextTracks,
            });
        }

        embed.setTimestamp();

        return embed;
    }

    /**
     * Create music control buttons
     * @param {string} guildId - Guild ID
     * @returns {ActionRowBuilder} Action row with control buttons
     */
    createMusicControlButtons(guildId) {
        const isPaused = this.controller.musicPlayerService.isPaused(guildId);
        const queue = this.controller.musicPlayerService.getQueue(guildId);
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

        // Row 1: playback controls (Discord max 5 buttons per row)
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('music_play_pause').setEmoji(playPauseEmoji).setStyle(playPauseStyle),
            new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('music_loop').setEmoji(loopEmoji).setStyle(loopStyle)
        );

        // Row 2: volume controls
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('music_volume_down').setEmoji('🔉').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_volume_up').setEmoji('🔊').setStyle(ButtonStyle.Secondary)
        );

        return [row1, row2];
    }

    /**
     * Create embed for queued track
     * @param {Object} track - Track object
     * @param {number} position - Position in queue
     * @returns {EmbedBuilder} Discord embed
     */
    createQueuedEmbed(track, position) {
        const embed = new EmbedBuilder()
            .setColor(0x00b894)
            .setTitle('✅ Added to Queue')
            .setDescription(`[${track.title}](${track.url})`)
            .addFields(
                { name: 'Duration', value: this.controller.formatDuration(track.duration), inline: true },
                { name: 'Position', value: `#${position}`, inline: true },
                { name: 'Requested By', value: `<@${track.requestedBy.id}>`, inline: true }
            )
            .setTimestamp();

        if (track.thumbnail) {
            embed.setThumbnail(track.thumbnail);
        }

        return embed;
    }

    /**
     * Create embed for queue display
     * @param {Object} queue - Queue object
     * @param {string} guildId - Guild ID
     * @returns {EmbedBuilder} Discord embed
     */
    createQueueEmbed(queue, guildId) {
        const embed = new EmbedBuilder()
            .setColor(0x00b894)
            .setTitle('🎵 Music Queue');

        // Add now playing
        if (queue.current) {
            const nowPlayingText = `[${queue.current.title}](${queue.current.url})\n` +
                `Duration: ${this.controller.formatDuration(queue.current.duration)} | ` +
                `Requested by: <@${queue.current.requestedBy.id}>`;

            embed.addFields({
                name: '🎶 Now Playing',
                value: nowPlayingText,
            });
        }

        // Add upcoming tracks
        if (queue.tracks.length > 0) {
            const upcoming = queue.tracks
                .slice(0, 10)
                .map((track, i) => {
                    return `**${i + 1}.** [${track.title}](${track.url}) - ${this.controller.formatDuration(track.duration)}`;
                })
                .join('\n');

            const remainingText = queue.tracks.length > 10
                ? `\n*...and ${queue.tracks.length - 10} more tracks*`
                : '';

            embed.addFields({
                name: `📋 Up Next (${queue.tracks.length} track${queue.tracks.length !== 1 ? 's' : ''})`,
                value: upcoming + remainingText,
            });
        }

        // Add queue info (already in queue object)
        const totalDuration = queue.tracks.reduce((sum, t) => sum + (t.duration || 0), 0) + (queue.current?.duration || 0);
        const loopMode = queue.loop;
        const volume = queue.volume;
        const currentFilter = queue.filter || 'none';

        const loopEmoji = {
            'off': '➡️',
            'track': '🔂',
            'queue': '🔁'
        };

        const filterEmoji = {
            'none': '🎵',
            'bassboost': '🔊',
            'nightcore': '⚡',
            'vaporwave': '🌊',
            '8d': '🎧',
            'karaoke': '🎤'
        };

        const filterName = currentFilter === 'none' ? 'None' : currentFilter.charAt(0).toUpperCase() + currentFilter.slice(1);

        embed.addFields({
            name: '⚙️ Settings',
            value: `Loop: ${loopEmoji[loopMode]} ${loopMode.charAt(0).toUpperCase() + loopMode.slice(1)} | ` +
                `Volume: 🔊 ${volume}% | ` +
                `Filter: ${filterEmoji[currentFilter]} ${filterName} | ` +
                `Total Duration: ⏱️ ${this.controller.formatDuration(totalDuration)}`,
        });

        embed.setTimestamp();

        return embed;
    }
}

module.exports = MusicEmbedBuilder;
