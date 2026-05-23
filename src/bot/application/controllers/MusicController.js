/**
 * MusicController
 * 
 * Handles all music-related commands
 * Delegates to specialized handlers for better separation of concerns
 */

const Controller = require('../../system/core/Controller');
const PlaybackHandler = require('./music/handlers/PlaybackHandler');
const QueueHandler = require('./music/handlers/QueueHandler');
const SettingsHandler = require('./music/handlers/SettingsHandler');
const PlaylistHandler = require('./music/handlers/PlaylistHandler');
const MusicEmbedBuilder = require('./music/handlers/EmbedBuilder');

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
        const { formatDuration, progressBar } = require('../../system/helpers/FormatHelper');
        const { validateVoiceChannel, validateBotPermissions } = require('../../system/helpers/ValidationHelper');

        this.formatDuration = formatDuration;
        this.progressBar = progressBar;
        this.validateVoiceChannel = validateVoiceChannel;
        this.validateBotPermissions = validateBotPermissions;

        // Initialize handlers
        this.playbackHandler = new PlaybackHandler(this);
        this.queueHandler = new QueueHandler(this);
        this.settingsHandler = new SettingsHandler(this);
        this.playlistHandler = new PlaylistHandler(this);
        this.embedBuilder = new MusicEmbedBuilder(this);
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

    // Playback commands - delegate to PlaybackHandler
    async play(interaction) { return this.playbackHandler.play(interaction); }
    async pause(interaction) { return this.playbackHandler.pause(interaction); }
    async resume(interaction) { return this.playbackHandler.resume(interaction); }
    async skip(interaction) { return this.playbackHandler.skip(interaction); }
    async stop(interaction) { return this.playbackHandler.stop(interaction); }

    // Queue commands - delegate to QueueHandler
    async queue(interaction) { return this.queueHandler.queue(interaction); }
    async nowplaying(interaction) { return this.queueHandler.nowplaying(interaction); }
    async shuffle(interaction) { return this.queueHandler.shuffle(interaction); }
    async clear(interaction) { return this.queueHandler.clear(interaction); }
    async remove(interaction) { return this.queueHandler.remove(interaction); }
    async jump(interaction) { return this.queueHandler.jump(interaction); }
    async move(interaction) { return this.queueHandler.move(interaction); }

    // Settings commands - delegate to SettingsHandler
    async volume(interaction) { return this.settingsHandler.volume(interaction); }
    async loop(interaction) { return this.settingsHandler.loop(interaction); }
    async filter(interaction) { return this.settingsHandler.filter(interaction); }
    async seek(interaction) { return this.settingsHandler.seek(interaction); }

    // Playlist commands - delegate to PlaylistHandler
    async playlistCreate(interaction) { return this.playlistHandler.playlistCreate(interaction); }
    async playlistSave(interaction) { return this.playlistHandler.playlistSave(interaction); }
    async playlistLoad(interaction) { return this.playlistHandler.playlistLoad(interaction); }
    async playlistDelete(interaction) { return this.playlistHandler.playlistDelete(interaction); }
    async playlistList(interaction) { return this.playlistHandler.playlistList(interaction); }

    // Embed building - delegate to MusicEmbedBuilder
    createNowPlayingEmbed(track, queue, currentPosition) {
        return this.embedBuilder.createNowPlayingEmbed(track, queue, currentPosition);
    }

    createMusicControlButtons(guildId) {
        return this.embedBuilder.createMusicControlButtons(guildId);
    }

    createQueuedEmbed(track, position) {
        return this.embedBuilder.createQueuedEmbed(track, position);
    }

    createQueueEmbed(queue, guildId) {
        return this.embedBuilder.createQueueEmbed(queue, guildId);
    }
}

module.exports = MusicController;
