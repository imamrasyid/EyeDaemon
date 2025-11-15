/**
 * Music Module Definition
 * 
 * Defines the music module structure with all commands and their mappings
 * to the MusicController methods
 */

module.exports = {
    name: 'Music',
    description: 'Music playback and queue management module',
    version: '1.0.0',

    // Controllers used by this module
    controllers: ['MusicController'],

    // Models used by this module
    models: ['MusicModel'],

    // Services used by this module
    services: ['MusicPlayerService', 'PlaylistService'],

    // Libraries used by this module
    libraries: ['VoiceManager', 'AudioPlayer', 'QueueManager'],

    // Command definitions with Discord slash command structure
    commands: [
        {
            name: 'play',
            description: 'Play music from URL or search query (YouTube, Spotify)',
            controller: 'MusicController',
            method: 'play',
            options: [
                {
                    name: 'query',
                    description: 'Song name, URL, or search query',
                    type: 3, // STRING
                    required: true,
                },
            ],
        },
        {
            name: 'pause',
            description: 'Pause the current playback',
            controller: 'MusicController',
            method: 'pause',
            options: [],
        },
        {
            name: 'resume',
            description: 'Resume paused playback',
            controller: 'MusicController',
            method: 'resume',
            options: [],
        },
        {
            name: 'skip',
            description: 'Skip the current track',
            controller: 'MusicController',
            method: 'skip',
            options: [],
        },
        {
            name: 'stop',
            description: 'Stop playback and clear the queue',
            controller: 'MusicController',
            method: 'stop',
            options: [],
        },
        {
            name: 'queue',
            description: 'Display the current music queue',
            controller: 'MusicController',
            method: 'queue',
            options: [],
        },
        {
            name: 'nowplaying',
            description: 'Show information about the currently playing track',
            controller: 'MusicController',
            method: 'nowplaying',
            options: [],
        },
        {
            name: 'volume',
            description: 'Set the playback volume',
            controller: 'MusicController',
            method: 'volume',
            options: [
                {
                    name: 'level',
                    description: 'Volume level (0-100)',
                    type: 4, // INTEGER
                    required: true,
                    min_value: 0,
                    max_value: 100,
                },
            ],
        },
        {
            name: 'loop',
            description: 'Set loop mode for playback',
            controller: 'MusicController',
            method: 'loop',
            options: [
                {
                    name: 'mode',
                    description: 'Loop mode',
                    type: 3, // STRING
                    required: true,
                    choices: [
                        { name: 'Off', value: 'off' },
                        { name: 'Track', value: 'track' },
                        { name: 'Queue', value: 'queue' },
                    ],
                },
            ],
        },
        {
            name: 'shuffle',
            description: 'Shuffle the current queue',
            controller: 'MusicController',
            method: 'shuffle',
            options: [],
        },
        {
            name: 'clear',
            description: 'Clear all tracks from the queue',
            controller: 'MusicController',
            method: 'clear',
            options: [],
        },
        {
            name: 'remove',
            description: 'Remove a specific track from the queue',
            controller: 'MusicController',
            method: 'remove',
            options: [
                {
                    name: 'position',
                    description: 'Position of the track to remove',
                    type: 4, // INTEGER
                    required: true,
                    min_value: 1,
                },
            ],
        },
        {
            name: 'jump',
            description: 'Jump to a specific track in the queue',
            controller: 'MusicController',
            method: 'jump',
            options: [
                {
                    name: 'position',
                    description: 'Position of the track to jump to',
                    type: 4, // INTEGER
                    required: true,
                    min_value: 1,
                },
            ],
        },
        {
            name: 'move',
            description: 'Move a track to a different position in the queue',
            controller: 'MusicController',
            method: 'move',
            options: [
                {
                    name: 'from',
                    description: 'Current position of the track',
                    type: 4, // INTEGER
                    required: true,
                    min_value: 1,
                },
                {
                    name: 'to',
                    description: 'New position for the track',
                    type: 4, // INTEGER
                    required: true,
                    min_value: 1,
                },
            ],
        },
        {
            name: 'seek',
            description: 'Seek to a specific time in the current track',
            controller: 'MusicController',
            method: 'seek',
            options: [
                {
                    name: 'time',
                    description: 'Time to seek to (format: MM:SS or seconds)',
                    type: 3, // STRING
                    required: true,
                },
            ],
        },
        {
            name: 'filter',
            description: 'Apply audio filters to playback',
            controller: 'MusicController',
            method: 'filter',
            options: [
                {
                    name: 'type',
                    description: 'Filter type',
                    type: 3, // STRING
                    required: true,
                    choices: [
                        { name: 'None', value: 'none' },
                        { name: 'Bass Boost', value: 'bassboost' },
                        { name: 'Nightcore', value: 'nightcore' },
                        { name: 'Vaporwave', value: 'vaporwave' },
                        { name: '8D', value: '8d' },
                        { name: 'Karaoke', value: 'karaoke' },
                    ],
                },
            ],
        },
        {
            name: 'playlist-create',
            description: 'Create a new playlist',
            controller: 'MusicController',
            method: 'playlistCreate',
            options: [
                {
                    name: 'name',
                    description: 'Playlist name',
                    type: 3, // STRING
                    required: true,
                },
                {
                    name: 'public',
                    description: 'Make playlist public (default: false)',
                    type: 5, // BOOLEAN
                    required: false,
                },
            ],
        },
        {
            name: 'playlist-save',
            description: 'Save current queue as a playlist',
            controller: 'MusicController',
            method: 'playlistSave',
            options: [
                {
                    name: 'name',
                    description: 'Playlist name',
                    type: 3, // STRING
                    required: true,
                },
                {
                    name: 'public',
                    description: 'Make playlist public (default: false)',
                    type: 5, // BOOLEAN
                    required: false,
                },
            ],
        },
        {
            name: 'playlist-load',
            description: 'Load a playlist into the queue',
            controller: 'MusicController',
            method: 'playlistLoad',
            options: [
                {
                    name: 'id',
                    description: 'Playlist ID',
                    type: 3, // STRING
                    required: true,
                },
            ],
        },
        {
            name: 'playlist-delete',
            description: 'Delete a playlist',
            controller: 'MusicController',
            method: 'playlistDelete',
            options: [
                {
                    name: 'id',
                    description: 'Playlist ID',
                    type: 3, // STRING
                    required: true,
                },
            ],
        },
        {
            name: 'playlist-list',
            description: 'List your playlists or public playlists',
            controller: 'MusicController',
            method: 'playlistList',
            options: [
                {
                    name: 'public',
                    description: 'Show public playlists instead of your own',
                    type: 5, // BOOLEAN
                    required: false,
                },
            ],
        },
    ],
};
