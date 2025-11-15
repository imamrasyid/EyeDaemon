/**
 * MusicController
 * 
 * Handles all music-related commands
 * Manages voice connections, audio playback, and queue operations
 */

const Controller = require('../../system/core/Controller');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { replyEphemeral } = require('../../system/helpers/interaction_helper');

class MusicController extends Controller {
    /**
     * Create a new MusicController instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client);

        // Load helpers
        this.load.helper('format');
        this.load.helper('validation');

        // Get services
        const musicModule = this.client.modules.get('music');
        this.musicPlayerService = musicModule ? musicModule.getService('MusicPlayerService') : null;
        this.playlistService = musicModule ? musicModule.getService('PlaylistService') : null;

        // Get GuildConfigService from admin module
        const adminModule = this.client.modules.get('admin');
        this.guildConfigService = adminModule ? adminModule.getService('GuildConfigService') : null;

        // Import helper functions into scope
        const { formatDuration, progressBar } = require('../../system/helpers/format_helper');
        const { validateVoiceChannel, validateBotPermissions } = require('../../system/helpers/validation_helper');

        this.formatDuration = formatDuration;
        this.progressBar = progressBar;
        this.validateVoiceChannel = validateVoiceChannel;
        this.validateBotPermissions = validateBotPermissions;
    }

    /**
     * Check if user has DJ role or is administrator
     * @param {Object} member - Guild member
     * @param {string} guildId - Guild ID
     * @returns {Promise<boolean>} True if user has DJ permissions
     */
    async hasDJPermissions(member, guildId) {
        try {
            // Administrators always have DJ permissions
            if (member.permissions.has('Administrator')) {
                return true;
            }

            // Check if DJ role is configured
            if (this.guildConfigService) {
                const djRoleId = await this.guildConfigService.getSetting(guildId, 'dj_role');

                if (djRoleId) {
                    // Check if member has DJ role
                    return member.roles.cache.has(djRoleId);
                }
            }

            // If no DJ role configured, everyone has permissions
            return true;
        } catch (error) {
            this.log(`Error checking DJ permissions: ${error.message}`, 'warn');
            // On error, allow the action
            return true;
        }
    }

    /**
     * Play command handler
     * Handles playing music from URL or search query
     * @param {Object} interaction - Discord interaction
     */
    async play(interaction) {
        try {
            await interaction.deferReply();

            const query = interaction.options.getString('query', true);
            const member = interaction.member;
            const guild = interaction.guild;

            // Validate voice channel
            const voiceChannel = this.validateVoiceChannel(member);
            this.validateBotPermissions(voiceChannel, guild);

            // Use service to play track
            const result = await this.musicPlayerService.play({
                guildId: guild.id,
                query: query,
                voiceChannel: voiceChannel,
                textChannel: interaction.channel,
                requester: interaction.user,
            });

            // Send response
            const embed = this.createQueuedEmbed(result.track, result.position);
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            this.log(`Error in play command: ${error.message}`, 'error');
            const errorMsg = error.message || 'Failed to play track';

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `❌ ${errorMsg}` });
            } else {
                await replyEphemeral(interaction, `❌ ${errorMsg}`);
            }
        }
    }



    /**
     * Pause command handler
     * Pauses the current playback
     * @param {Object} interaction - Discord interaction
     */
    async pause(interaction) {
        try {
            const guildId = interaction.guild.id;

            // Check if something is playing
            if (!this.musicPlayerService.isPlaying(guildId)) {
                await replyEphemeral(interaction, '❌ Nothing is currently playing');
                return;
            }

            // Pause playback
            const success = this.musicPlayerService.pause(guildId);

            if (success) {
                await interaction.reply('⏸️ Paused playback');
                this.log(`Paused playback in guild ${guildId}`, 'info');
            } else {
                await replyEphemeral(interaction, '❌ Failed to pause playback');
            }
        } catch (error) {
            this.log(`Error in pause command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to pause playback');
        }
    }

    /**
     * Resume command handler
     * Resumes paused playback
     * @param {Object} interaction - Discord interaction
     */
    async resume(interaction) {
        try {
            const guildId = interaction.guild.id;

            // Check if something is paused
            if (!this.musicPlayerService.isPaused(guildId)) {
                await replyEphemeral(interaction, '❌ Nothing is currently paused');
                return;
            }

            // Resume playback
            const success = this.musicPlayerService.resume(guildId);

            if (success) {
                await interaction.reply('▶️ Resumed playback');
                this.log(`Resumed playback in guild ${guildId}`, 'info');
            } else {
                await replyEphemeral(interaction, '❌ Failed to resume playback');
            }
        } catch (error) {
            this.log(`Error in resume command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to resume playback');
        }
    }

    /**
     * Skip command handler
     * Skips the current track
     * @param {Object} interaction - Discord interaction
     */
    async skip(interaction) {
        try {
            const guildId = interaction.guild.id;

            // Check DJ permissions
            const hasDJ = await this.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            // Check if something is playing
            const current = this.musicPlayerService.getCurrent(guildId);
            if (!current) {
                await replyEphemeral(interaction, '❌ Nothing is currently playing');
                return;
            }

            // Skip track
            this.musicPlayerService.skip(guildId);

            await interaction.reply(`⏭️ Skipped **${current.title}**`);
            this.log(`Skipped track in guild ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error in skip command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to skip track');
        }
    }

    /**
     * Stop command handler
     * Stops playback and clears queue
     * @param {Object} interaction - Discord interaction
     */
    async stop(interaction) {
        try {
            const guildId = interaction.guild.id;

            // Check DJ permissions
            const hasDJ = await this.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            // Check if bot is connected
            if (!this.musicPlayerService.isConnected(guildId)) {
                await replyEphemeral(interaction, '❌ I am not in a voice channel');
                return;
            }

            // Stop playback
            await this.musicPlayerService.stop(guildId);

            await interaction.reply('⏹️ Stopped playback and left voice channel');
            this.log(`Stopped playback in guild ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error in stop command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to stop playback');
        }
    }

    /**
     * Queue command handler
     * Displays the current queue
     * @param {Object} interaction - Discord interaction
     */
    async queue(interaction) {
        try {
            const guildId = interaction.guild.id;
            const queue = this.musicPlayerService.getQueue(guildId);

            // Check if queue is empty
            if (!queue.current && queue.tracks.length === 0) {
                await replyEphemeral(interaction, '❌ Queue is empty');
                return;
            }

            // Create queue embed
            const embed = this.createQueueEmbed(queue, guildId);
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            this.log(`Error in queue command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to display queue');
        }
    }

    /**
     * Now playing command handler
     * Shows information about the currently playing track
     * @param {Object} interaction - Discord interaction
     */
    async nowplaying(interaction) {
        try {
            const guildId = interaction.guild.id;
            const current = this.musicPlayerService.getCurrent(guildId);

            if (!current) {
                await replyEphemeral(interaction, '❌ Nothing is currently playing');
                return;
            }

            const queue = this.musicPlayerService.getQueue(guildId);

            // Get current position if playing
            let currentPosition = null;
            if (this.musicPlayerService.isPlaying(guildId)) {
                currentPosition = this.musicPlayerService.getCurrentPosition(guildId);
            }

            const embed = this.createNowPlayingEmbed(current, queue, currentPosition);
            const buttons = this.createMusicControlButtons(guildId);

            await interaction.reply({ embeds: [embed], components: [buttons] });
        } catch (error) {
            this.log(`Error in nowplaying command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to display now playing');
        }
    }

    /**
     * Volume command handler
     * Sets the playback volume
     * @param {Object} interaction - Discord interaction
     */
    async volume(interaction) {
        try {
            const guildId = interaction.guild.id;
            const level = interaction.options.getInteger('level', true);

            // Check DJ permissions
            const hasDJ = await this.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            // Check if bot is playing
            if (!this.musicPlayerService.isConnected(guildId)) {
                await replyEphemeral(interaction, '❌ I am not in a voice channel');
                return;
            }

            // Set volume using service
            await this.musicPlayerService.setVolume(guildId, level);

            await interaction.reply(`🔊 Volume set to **${level}%**`);
            this.log(`Set volume to ${level}% in guild ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error in volume command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to set volume');
        }
    }

    /**
     * Loop command handler
     * Sets the loop mode
     * @param {Object} interaction - Discord interaction
     */
    async loop(interaction) {
        try {
            const guildId = interaction.guild.id;
            const mode = interaction.options.getString('mode', true);

            // Check DJ permissions
            const hasDJ = await this.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            // Check if bot is playing
            if (!this.musicPlayerService.isConnected(guildId)) {
                await replyEphemeral(interaction, '❌ I am not in a voice channel');
                return;
            }

            // Set loop mode using service
            await this.musicPlayerService.setLoop(guildId, mode);

            const loopEmoji = {
                'off': '➡️',
                'track': '🔂',
                'queue': '🔁'
            };

            await interaction.reply(`${loopEmoji[mode]} Loop mode set to **${mode}**`);
            this.log(`Set loop mode to ${mode} in guild ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error in loop command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to set loop mode');
        }
    }

    /**
     * Shuffle command handler
     * Shuffles the current queue
     * @param {Object} interaction - Discord interaction
     */
    async shuffle(interaction) {
        try {
            const guildId = interaction.guild.id;

            // Check DJ permissions
            const hasDJ = await this.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            const queue = this.musicPlayerService.getQueue(guildId);
            if (queue.tracks.length === 0) {
                await replyEphemeral(interaction, '❌ Queue is empty');
                return;
            }

            // Shuffle queue using service
            await this.musicPlayerService.shuffle(guildId);

            await interaction.reply(`🔀 Shuffled **${queue.tracks.length}** tracks`);
            this.log(`Shuffled queue in guild ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error in shuffle command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to shuffle queue');
        }
    }

    /**
     * Clear command handler
     * Clears all tracks from the queue
     * @param {Object} interaction - Discord interaction
     */
    async clear(interaction) {
        try {
            const guildId = interaction.guild.id;

            // Check DJ permissions
            const hasDJ = await this.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            const queue = this.musicPlayerService.getQueue(guildId);
            if (queue.tracks.length === 0) {
                await replyEphemeral(interaction, '❌ Queue is already empty');
                return;
            }

            const trackCount = queue.tracks.length;

            // Clear queue using service
            await this.musicPlayerService.clearQueue(guildId);

            await interaction.reply(`🗑️ Cleared **${trackCount}** tracks from queue`);
            this.log(`Cleared queue in guild ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error in clear command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to clear queue');
        }
    }

    /**
     * Remove command handler
     * Removes a specific track from the queue
     * @param {Object} interaction - Discord interaction
     */
    async remove(interaction) {
        try {
            const guildId = interaction.guild.id;
            const position = interaction.options.getInteger('position', true);

            // Check DJ permissions
            const hasDJ = await this.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            // Remove track using service
            const removed = await this.musicPlayerService.removeTrack(guildId, position - 1);

            if (removed) {
                await interaction.reply(`🗑️ Removed **${removed.title}** from queue`);
                this.log(`Removed track at position ${position} in guild ${guildId}`, 'info');
            } else {
                await replyEphemeral(interaction, `❌ No track at position ${position}`);
            }
        } catch (error) {
            this.log(`Error in remove command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to remove track');
        }
    }

    /**
     * Jump command handler
     * Jumps to a specific track in the queue
     * @param {Object} interaction - Discord interaction
     */
    async jump(interaction) {
        try {
            const guildId = interaction.guild.id;
            const position = interaction.options.getInteger('position', true);

            // Check DJ permissions
            const hasDJ = await this.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            // Jump to track using service
            const track = await this.musicPlayerService.jumpTo(guildId, position - 1);

            if (track) {
                await interaction.reply(`⏭️ Jumped to **${track.title}**`);
                this.log(`Jumped to position ${position} in guild ${guildId}`, 'info');
            } else {
                await replyEphemeral(interaction, `❌ No track at position ${position}`);
            }
        } catch (error) {
            this.log(`Error in jump command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to jump to track');
        }
    }

    /**
     * Move command handler
     * Moves a track to a different position in the queue
     * @param {Object} interaction - Discord interaction
     */
    async move(interaction) {
        try {
            const guildId = interaction.guild.id;
            const from = interaction.options.getInteger('from', true);
            const to = interaction.options.getInteger('to', true);

            // Check DJ permissions
            const hasDJ = await this.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            // Move track using service
            const success = await this.musicPlayerService.moveTrack(guildId, from - 1, to - 1);

            if (success) {
                await interaction.reply(`↔️ Moved track from position **${from}** to **${to}**`);
                this.log(`Moved track from ${from} to ${to} in guild ${guildId}`, 'info');
            } else {
                await replyEphemeral(interaction, '❌ Failed to move track');
            }
        } catch (error) {
            this.log(`Error in move command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to move track');
        }
    }

    /**
     * Seek command handler
     * Seeks to a specific time in the current track
     * @param {Object} interaction - Discord interaction
     */
    async seek(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const timeStr = interaction.options.getString('time', true);

            // Check DJ permissions
            const hasDJ = await this.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await interaction.editReply({ content: '❌ You need the DJ role to use this command' });
                return;
            }

            // Check if something is playing
            const current = this.musicPlayerService.getCurrent(guildId);
            if (!current) {
                await interaction.editReply({ content: '❌ Nothing is currently playing' });
                return;
            }

            // Parse time (MM:SS or seconds)
            let seconds;
            if (timeStr.includes(':')) {
                const parts = timeStr.split(':');
                seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            } else {
                seconds = parseInt(timeStr);
            }

            if (isNaN(seconds) || seconds < 0) {
                await interaction.editReply({ content: '❌ Invalid time format. Use MM:SS or seconds' });
                return;
            }

            if (seconds > current.duration) {
                await interaction.editReply({ content: `❌ Time exceeds track duration (${this.formatDuration(current.duration)})` });
                return;
            }

            // Seek using service
            await this.musicPlayerService.seek(guildId, seconds);

            await interaction.editReply(`⏩ Seeked to **${this.formatDuration(seconds)}** in **${current.title}**`);
            this.log(`Seeked to ${seconds}s in guild ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error in seek command: ${error.message}`, 'error');

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `❌ ${error.message || 'Failed to seek'}` });
            } else {
                await this.sendError(interaction, error.message || 'Failed to seek');
            }
        }
    }

    /**
     * Filter command handler
     * Applies audio filters to playback
     * @param {Object} interaction - Discord interaction
     */
    async filter(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const filterType = interaction.options.getString('type', true);

            // Check DJ permissions
            const hasDJ = await this.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await interaction.editReply({ content: '❌ You need the DJ role to use this command' });
                return;
            }

            // Check if bot is connected
            if (!this.musicPlayerService.isConnected(guildId)) {
                await interaction.editReply({ content: '❌ I am not in a voice channel' });
                return;
            }

            // Set filter using service
            const success = await this.musicPlayerService.setFilter(guildId, filterType);

            if (!success) {
                await interaction.editReply({ content: '❌ Invalid filter type' });
                return;
            }

            const filterEmoji = {
                'none': '🎵',
                'bassboost': '🔊',
                'nightcore': '⚡',
                'vaporwave': '🌊',
                '8d': '🎧',
                'karaoke': '🎤'
            };

            const filterName = filterType === 'none' ? 'No filter' : filterType.charAt(0).toUpperCase() + filterType.slice(1);
            await interaction.editReply(`${filterEmoji[filterType]} Applied **${filterName}** filter`);
            this.log(`Applied ${filterType} filter in guild ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error in filter command: ${error.message}`, 'error');

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ Failed to apply filter' });
            } else {
                await this.sendError(interaction, 'Failed to apply filter');
            }
        }
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
            const playlist = await this.playlistService.createPlaylist({
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                name: name,
                isPublic: isPublic,
            });

            const visibilityText = isPublic ? '🌐 Public' : '🔒 Private';
            await interaction.reply(`✅ Created playlist **${playlist.name}** (${visibilityText})\nPlaylist ID: \`${playlist.id}\``);
            this.log(`Created playlist ${playlist.id} for user ${interaction.user.id}`, 'info');
        } catch (error) {
            this.log(`Error in playlist-create command: ${error.message}`, 'error');
            await this.sendError(interaction, error.message || 'Failed to create playlist');
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
            const queue = this.musicPlayerService.getQueue(interaction.guild.id);
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
            const playlist = await this.playlistService.saveCurrentQueue({
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                name: name,
                tracks: tracks,
                isPublic: isPublic,
            });

            const visibilityText = isPublic ? '🌐 Public' : '🔒 Private';
            await interaction.reply(`✅ Saved **${playlist.trackCount}** tracks to playlist **${playlist.name}** (${visibilityText})\nPlaylist ID: \`${playlist.id}\``);
            this.log(`Saved queue as playlist ${playlist.id} for user ${interaction.user.id}`, 'info');
        } catch (error) {
            this.log(`Error in playlist-save command: ${error.message}`, 'error');
            await this.sendError(interaction, error.message || 'Failed to save playlist');
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
            const voiceChannel = this.validateVoiceChannel(member);
            this.validateBotPermissions(voiceChannel, guild);

            // Get playlist tracks
            const tracks = await this.playlistService.loadPlaylistTracks(playlistId, interaction.user.id);

            if (tracks.length === 0) {
                await interaction.editReply({ content: '❌ Playlist is empty!' });
                return;
            }

            // Add tracks to queue
            let addedCount = 0;
            for (const track of tracks) {
                try {
                    await this.musicPlayerService.play({
                        guildId: guild.id,
                        query: track.url,
                        voiceChannel: voiceChannel,
                        textChannel: interaction.channel,
                        requester: interaction.user,
                    });
                    addedCount++;
                } catch (error) {
                    this.log(`Failed to add track ${track.title}: ${error.message}`, 'warn');
                }
            }

            await interaction.editReply(`✅ Loaded **${addedCount}** tracks from playlist to queue`);
            this.log(`Loaded playlist ${playlistId} for user ${interaction.user.id}`, 'info');
        } catch (error) {
            this.log(`Error in playlist-load command: ${error.message}`, 'error');
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
            await this.playlistService.deletePlaylist(playlistId, interaction.user.id);

            await interaction.reply(`✅ Deleted playlist \`${playlistId}\``);
            this.log(`Deleted playlist ${playlistId} for user ${interaction.user.id}`, 'info');
        } catch (error) {
            this.log(`Error in playlist-delete command: ${error.message}`, 'error');
            await this.sendError(interaction, error.message || 'Failed to delete playlist');
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
                playlists = await this.playlistService.getPublicPlaylists(interaction.guild.id);
            } else {
                playlists = await this.playlistService.getUserPlaylists(interaction.user.id, interaction.guild.id);
            }

            if (playlists.length === 0) {
                const message = showPublic ? 'No public playlists found' : 'You have no playlists';
                await replyEphemeral(interaction, `❌ ${message}`);
                return;
            }

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(0x00b894)
                .setTitle(showPublic ? '🌐 Public Playlists' : '📋 Your Playlists')
                .setDescription(playlists.map((p, i) => {
                    const visibility = p.isPublic ? '🌐' : '🔒';
                    return `**${i + 1}.** ${visibility} ${p.name}\n` +
                        `   ID: \`${p.id}\` | Tracks: ${p.trackCount}`;
                }).join('\n\n'))
                .setFooter({ text: `Total: ${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            this.log(`Error in playlist-list command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to list playlists');
        }
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
            const progress = this.progressBar(currentMs, track.duration, 20);
            embed.addFields(
                {
                    name: 'Progress',
                    value: `${this.formatDuration(currentMs)} ${progress} ${this.formatDuration(track.duration)}`,
                    inline: false
                }
            );
        } else {
            embed.addFields(
                { name: 'Duration', value: this.formatDuration(track.duration), inline: true }
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
        const isPaused = this.musicPlayerService.isPaused(guildId);
        const queue = this.musicPlayerService.getQueue(guildId);
        const loopMode = queue.loop || 'off';

        // Determine play/pause button style and emoji
        const playPauseEmoji = isPaused ? '▶️' : '⏸️';
        const playPauseStyle = isPaused ? ButtonStyle.Success : ButtonStyle.Secondary;

        // Determine loop button style based on mode
        let loopStyle = ButtonStyle.Secondary;
        let loopEmoji = '➡️';
        if (loopMode === 'track') {
            loopStyle = ButtonStyle.Primary;
            loopEmoji = '🔂';
        } else if (loopMode === 'queue') {
            loopStyle = ButtonStyle.Primary;
            loopEmoji = '🔁';
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('music_play_pause')
                    .setEmoji(playPauseEmoji)
                    .setStyle(playPauseStyle),
                new ButtonBuilder()
                    .setCustomId('music_skip')
                    .setEmoji('⏭️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('music_stop')
                    .setEmoji('⏹️')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('music_loop')
                    .setEmoji(loopEmoji)
                    .setStyle(loopStyle),
                new ButtonBuilder()
                    .setCustomId('music_volume_down')
                    .setEmoji('🔉')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Create second row for volume up (if needed, we can add more buttons later)
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('music_volume_up')
                    .setEmoji('🔊')
                    .setStyle(ButtonStyle.Secondary)
            );

        return row;
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
                { name: 'Duration', value: this.formatDuration(track.duration), inline: true },
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
                `Duration: ${this.formatDuration(queue.current.duration)} | ` +
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
                    return `**${i + 1}.** [${track.title}](${track.url}) - ${this.formatDuration(track.duration)}`;
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
                `Total Duration: ⏱️ ${this.formatDuration(totalDuration)}`,
        });

        embed.setTimestamp();

        return embed;
    }
}

module.exports = MusicController;
