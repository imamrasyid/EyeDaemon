/**
 * PlaylistHandler
 * 
 * Handles playlist commands: create, save, load, delete, list
 */

const { replyEphemeral } = require('../../../../system/helpers/InteractionHelper');

class PlaylistHandler {
    constructor(controller) {
        this.controller = controller;
    }

    /**
     * Playlist create command handler
     * Creates a new playlist
     * @param {Object} interaction - Discord interaction
     */
    async playlistCreate(interaction) {
        try {
            const name = interaction.options.getString('name', true);
            const isPublic = interaction.options.getBoolean('public') || false;

            // Create playlist using service
            const playlist = await this.controller.playlistService.createPlaylist({
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                name: name,
                isPublic: isPublic,
            });

            const visibilityText = isPublic ? '🌐 Public' : '🔒 Private';
            await interaction.reply(`✅ Created playlist **${playlist.name}** (${visibilityText})\nPlaylist ID: \`${playlist.id}\``);
            this.controller.log(`Created playlist ${playlist.id} for user ${interaction.user.id}`, 'info');
        } catch (error) {
            this.controller.log(`Error in playlist-create command: ${error.message}`, 'error');
            await this.controller.sendError(interaction, error.message || 'Failed to create playlist');
        }
    }

    /**
     * Playlist save command handler
     * Saves current queue as a playlist
     * @param {Object} interaction - Discord interaction
     */
    async playlistSave(interaction) {
        try {
            const name = interaction.options.getString('name', true);
            const isPublic = interaction.options.getBoolean('public') || false;

            // Get current queue
            const queue = this.controller.musicPlayerService.getQueue(interaction.guild.id);
            const tracks = [];

            // Add current track if playing
            if (queue.current) {
                tracks.push({
                    title: queue.current.title,
                    url: queue.current.url,
                    duration: queue.current.duration,
                    thumbnail: queue.current.thumbnail,
                });
            }

            // Add queued tracks
            tracks.push(...queue.tracks.map(t => ({
                title: t.title,
                url: t.url,
                duration: t.duration,
                thumbnail: t.thumbnail,
            })));

            if (tracks.length === 0) {
                await replyEphemeral(interaction, '❌ Queue is empty. Nothing to save!');
                return;
            }

            // Save queue as playlist
            const playlist = await this.controller.playlistService.saveCurrentQueue({
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                name: name,
                tracks: tracks,
                isPublic: isPublic,
            });

            const visibilityText = isPublic ? '🌐 Public' : '🔒 Private';
            await interaction.reply(`✅ Saved **${playlist.trackCount}** tracks to playlist **${playlist.name}** (${visibilityText})\nPlaylist ID: \`${playlist.id}\``);
            this.controller.log(`Saved queue as playlist ${playlist.id} for user ${interaction.user.id}`, 'info');
        } catch (error) {
            this.controller.log(`Error in playlist-save command: ${error.message}`, 'error');
            await this.controller.sendError(interaction, error.message || 'Failed to save playlist');
        }
    }

    /**
     * Playlist load command handler
     * Loads a playlist into the queue
     * @param {Object} interaction - Discord interaction
     */
    async playlistLoad(interaction) {
        try {
            await interaction.deferReply();

            const playlistId = interaction.options.getString('id', true);
            const member = interaction.member;
            const guild = interaction.guild;

            // Validate voice channel
            const voiceChannel = this.controller.validateVoiceChannel(member);
            this.controller.validateBotPermissions(voiceChannel, guild);

            // Get playlist tracks
            const tracks = await this.controller.playlistService.loadPlaylistTracks(playlistId, interaction.user.id);

            if (tracks.length === 0) {
                await interaction.editReply({ content: '❌ Playlist is empty!' });
                return;
            }

            // Add tracks to queue — join voice once, then add all tracks
            // without re-fetching metadata for each (use URL directly)
            let addedCount = 0;

            for (const track of tracks) {
                try {
                    await this.controller.musicPlayerService.play({
                        guildId: guild.id,
                        query: track.url,
                        voiceChannel: voiceChannel,
                        textChannel: interaction.channel,
                        requester: interaction.user,
                    });
                    addedCount++;
                } catch (error) {
                    this.controller.log(`Failed to add track ${track.title}: ${error.message}`, 'warn');
                }
            }

            await interaction.editReply(`✅ Loaded **${addedCount}** tracks from playlist to queue`);
            this.controller.log(`Loaded playlist ${playlistId} for user ${interaction.user.id}`, 'info');
        } catch (error) {
            this.controller.log(`Error in playlist-load command: ${error.message}`, 'error');
            const errorMsg = error.message || 'Failed to load playlist';

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `❌ ${errorMsg}` });
            } else {
                await replyEphemeral(interaction, `❌ ${errorMsg}`);
            }
        }
    }

    /**
     * Playlist delete command handler
     * Deletes a playlist
     * @param {Object} interaction - Discord interaction
     */
    async playlistDelete(interaction) {
        try {
            const playlistId = interaction.options.getString('id', true);

            // Delete playlist using service
            await this.controller.playlistService.deletePlaylist(playlistId, interaction.user.id);

            await interaction.reply(`✅ Deleted playlist \`${playlistId}\``);
            this.controller.log(`Deleted playlist ${playlistId} for user ${interaction.user.id}`, 'info');
        } catch (error) {
            this.controller.log(`Error in playlist-delete command: ${error.message}`, 'error');
            await this.controller.sendError(interaction, error.message || 'Failed to delete playlist');
        }
    }

    /**
     * Playlist list command handler
     * Lists user's playlists or public playlists
     * @param {Object} interaction - Discord interaction
     */
    async playlistList(interaction) {
        try {
            const showPublic = interaction.options.getBoolean('public') || false;

            let playlists;
            if (showPublic) {
                playlists = await this.controller.playlistService.getPublicPlaylists(interaction.guild.id);
            } else {
                playlists = await this.controller.playlistService.getUserPlaylists(interaction.user.id, interaction.guild.id);
            }

            if (playlists.length === 0) {
                const message = showPublic ? 'No public playlists found' : 'You have no playlists';
                await replyEphemeral(interaction, `❌ ${message}`);
                return;
            }

            const ResponseHelper = require('../../../../system/helpers/ResponseHelper');
            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.MUSIC,
                title: showPublic ? '🌐 Public Server Playlists' : '📋 Your Saved Playlists',
                description: playlists.map((p, i) => {
                    const visibility = p.isPublic ? '🌐 Public' : '🔒 Private';
                    return `**${i + 1}.** ${p.name}\n> **Visibility:** \`${visibility}\` • **Tracks:** \`${p.trackCount || p.tracks?.length || 0}\` • **ID:** \`${p.id}\``;
                }).join('\n\n'),
                footerText: `Total: ${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}`
            });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            this.controller.log(`Error in playlist-list command: ${error.message}`, 'error');
            await this.controller.sendError(interaction, 'Failed to list playlists');
        }
    }
}

module.exports = PlaylistHandler;
