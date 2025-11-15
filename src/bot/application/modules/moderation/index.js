/**
 * Moderation Module Definition
 * 
 * Defines the moderation module structure with all commands and their mappings
 * to the ModerationController methods
 */

module.exports = {
    name: 'Moderation',
    description: 'Moderation tools and auto-moderation',
    version: '1.0.0',

    // Controllers used by this module
    controllers: ['ModerationController'],

    // Models used by this module
    models: ['ModerationModel'],

    // Libraries used by this module
    libraries: [],

    // Command definitions with Discord slash command structure
    commands: [
        {
            name: 'warn',
            description: 'Warn a user',
            controller: 'ModerationController',
            method: 'warn',
            options: [
                {
                    name: 'user',
                    description: 'User to warn',
                    type: 6, // USER
                    required: true,
                },
                {
                    name: 'reason',
                    description: 'Reason for warning',
                    type: 3, // STRING
                    required: false,
                },
            ],
        },
        {
            name: 'kick',
            description: 'Kick a user from the server',
            controller: 'ModerationController',
            method: 'kick',
            options: [
                {
                    name: 'user',
                    description: 'User to kick',
                    type: 6, // USER
                    required: true,
                },
                {
                    name: 'reason',
                    description: 'Reason for kick',
                    type: 3, // STRING
                    required: false,
                },
            ],
        },
        {
            name: 'ban',
            description: 'Ban a user from the server',
            controller: 'ModerationController',
            method: 'ban',
            options: [
                {
                    name: 'user',
                    description: 'User to ban',
                    type: 6, // USER
                    required: true,
                },
                {
                    name: 'reason',
                    description: 'Reason for ban',
                    type: 3, // STRING
                    required: false,
                },
                {
                    name: 'delete_messages',
                    description: 'Days of messages to delete (0-7)',
                    type: 4, // INTEGER
                    required: false,
                    min_value: 0,
                    max_value: 7,
                },
            ],
        },
        {
            name: 'unban',
            description: 'Unban a user from the server',
            controller: 'ModerationController',
            method: 'unban',
            options: [
                {
                    name: 'user_id',
                    description: 'User ID to unban',
                    type: 3, // STRING
                    required: true,
                },
                {
                    name: 'reason',
                    description: 'Reason for unban',
                    type: 3, // STRING
                    required: false,
                },
            ],
        },
        {
            name: 'timeout',
            description: 'Timeout a user',
            controller: 'ModerationController',
            method: 'timeout',
            options: [
                {
                    name: 'user',
                    description: 'User to timeout',
                    type: 6, // USER
                    required: true,
                },
                {
                    name: 'duration',
                    description: 'Duration in minutes',
                    type: 4, // INTEGER
                    required: true,
                    min_value: 1,
                    max_value: 40320, // 28 days
                },
                {
                    name: 'reason',
                    description: 'Reason for timeout',
                    type: 3, // STRING
                    required: false,
                },
            ],
        },
        {
            name: 'purge',
            description: 'Delete multiple messages',
            controller: 'ModerationController',
            method: 'purge',
            options: [
                {
                    name: 'amount',
                    description: 'Number of messages to delete (1-100)',
                    type: 4, // INTEGER
                    required: true,
                    min_value: 1,
                    max_value: 100,
                },
            ],
        },
        {
            name: 'warnings',
            description: 'View warnings for a user',
            controller: 'ModerationController',
            method: 'warnings',
            options: [
                {
                    name: 'user',
                    description: 'User to view warnings for',
                    type: 6, // USER
                    required: false,
                },
            ],
        },
    ],
};
