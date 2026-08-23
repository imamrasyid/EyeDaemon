/**
 * MusicEmbedBuilder
 * 
 * Helper class for creating music-related embeds with ResponseHelper.
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ResponseHelper = require('../../../../system/helpers/ResponseHelper');

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
    createNowPlayingEmbed(track, queue = {}, currentPosition = null) {
        const positionSecs = currentPosition !== null && currentPosition >= 0 ? currentPosition : 0;
        const durationSecs = track.duration > 10000 ? Math.floor(track.duration / 1000) : (track.duration || 180);

        return ResponseHelper.nowPlayingCard({
            track: {
                title: track.title,
                author: track.author || track.uploader || 'Unknown Artist',
                url: track.url,
                thumbnail: track.thumbnail,
                duration: durationSecs,
                requestedBy: track.requestedBy?.id || track.requestedBy,
            },
            queue,
            position: positionSecs,
            isPaused: queue.paused || false,
            loopMode: queue.loop || 'off',
            volume: queue.volume || 80,
            filter: queue.filter || 'none',
        });
    }

    /**
     * Create music control buttons
     * @param {string} guildId - Guild ID
     * @returns {ActionRowBuilder[]} Action rows with control buttons
     */
    createMusicControlButtons(guildId) {
        const isPaused = this.controller.musicPlayerService ? this.controller.musicPlayerService.isPaused(guildId) : false;
        const queue = this.controller.musicPlayerService ? this.controller.musicPlayerService.getQueue(guildId) : {};
        const loopMode = queue?.loop || 'off';

        return ResponseHelper.musicControlsRow({ isPaused, loopMode });
    }

    /**
     * Create embed for queued track
     * @param {Object} track - Track object
     * @param {number} position - Position in queue
     * @returns {EmbedBuilder} Discord embed
     */
    createQueuedEmbed(track, position) {
        const durationFormatted = this.controller.formatDuration(track.duration);

        return ResponseHelper.createEmbed({
            color: ResponseHelper.THEMES.SUCCESS,
            title: '✅ Added to Music Queue',
            description: `### [${track.title}](${track.url || 'https://discord.com'})`,
            thumbnail: track.thumbnail || undefined,
            fields: [
                { name: 'Duration', value: `\`${durationFormatted}\``, inline: true },
                { name: 'Queue Position', value: `\`#${position}\``, inline: true },
                { name: 'Requested By', value: `<@${track.requestedBy?.id || track.requestedBy}>`, inline: true },
            ],
            footerText: 'Track added to playlist queue'
        });
    }

    /**
     * Create embed for queue display
     * @param {Object} queue - Queue object
     * @param {string} guildId - Guild ID
     * @returns {EmbedBuilder} Discord embed
     */
    createQueueEmbed(queue, guildId) {
        const current = queue.current || queue.currentTrack;
        const tracks = queue.tracks || [];

        const embed = ResponseHelper.createEmbed({
            color: ResponseHelper.THEMES.MUSIC,
            title: `🎵 Music Queue (${tracks.length + (current ? 1 : 0)} Tracks)`,
        });

        if (current) {
            embed.addFields({
                name: '▶️ Currently Playing',
                value: `[${current.title}](${current.url || 'https://discord.com'}) • \`${this.controller.formatDuration(current.duration)}\` • Requested by <@${current.requestedBy?.id || current.requestedBy}>`,
                inline: false,
            });
        }

        if (tracks.length > 0) {
            const upcoming = tracks
                .slice(0, 10)
                .map((t, i) => `**${i + 1}.** [${t.title}](${t.url || 'https://discord.com'}) — \`${this.controller.formatDuration(t.duration)}\``)
                .join('\n');

            const remaining = tracks.length > 10 ? `\n*...and ${tracks.length - 10} more tracks in queue*` : '';

            embed.addFields({
                name: `📜 Up Next in Queue`,
                value: upcoming + remaining,
                inline: false,
            });
        } else if (!current) {
            embed.setDescription('The music queue is currently empty! Use `/play <query>` to queue a song.');
        }

        const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0) + (current?.duration || 0);
        embed.addFields({
            name: '⚙️ Playback Settings',
            value: `**Loop:** \`${(queue.loop || 'off').toUpperCase()}\` • **Volume:** \`${queue.volume || 80}%\` • **Filter:** \`${queue.filter || 'none'}\` • **Total Duration:** \`${this.controller.formatDuration(totalDuration)}\``,
            inline: false,
        });

        return embed;
    }
}

module.exports = MusicEmbedBuilder;
