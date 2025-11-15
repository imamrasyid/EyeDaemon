/**
 * Leveling Module Definition
 * 
 * Defines the leveling module structure with all commands and their mappings
 * to the LevelingController methods
 */

module.exports = {
    name: 'Leveling',
    description: 'XP and leveling system with rewards',
    version: '1.0.0',

    // Controllers used by this module
    controllers: ['LevelingController'],

    // Models used by this module
    models: ['LevelingModel'],

    // Services used by this module
    services: ['LevelingService', 'RewardService'],

    // Libraries used by this module
    libraries: [],

    // Command definitions with Discord slash command structure
    commands: [
        {
            name: 'rank',
            description: 'Check your or another user\'s rank and level',
            controller: 'LevelingController',
            method: 'rank',
            options: [
                {
                    name: 'user',
                    description: 'User to check rank for',
                    type: 6, // USER
                    required: false,
                },
            ],
        },
        {
            name: 'leaderboard',
            description: 'View the server leaderboard',
            controller: 'LevelingController',
            method: 'leaderboard',
            options: [
                {
                    name: 'type',
                    description: 'Leaderboard type',
                    type: 3, // STRING
                    required: false,
                    choices: [
                        { name: 'XP', value: 'xp' },
                        { name: 'Level', value: 'level' },
                        { name: 'Messages', value: 'messages' },
                    ],
                },
            ],
        },
        {
            name: 'givexp',
            description: 'Give XP to a user (Admin only)',
            controller: 'LevelingController',
            method: 'givexp',
            options: [
                {
                    name: 'user',
                    description: 'User to give XP to',
                    type: 6, // USER
                    required: true,
                },
                {
                    name: 'amount',
                    description: 'Amount of XP to give',
                    type: 4, // INTEGER
                    required: true,
                    min_value: 1,
                },
            ],
        },
        {
            name: 'removexp',
            description: 'Remove XP from a user (Admin only)',
            controller: 'LevelingController',
            method: 'removexp',
            options: [
                {
                    name: 'user',
                    description: 'User to remove XP from',
                    type: 6, // USER
                    required: true,
                },
                {
                    name: 'amount',
                    description: 'Amount of XP to remove',
                    type: 4, // INTEGER
                    required: true,
                    min_value: 1,
                },
            ],
        },
        {
            name: 'setlevel',
            description: 'Set a user\'s level (Admin only)',
            controller: 'LevelingController',
            method: 'setlevel',
            options: [
                {
                    name: 'user',
                    description: 'User to set level for',
                    type: 6, // USER
                    required: true,
                },
                {
                    name: 'level',
                    description: 'Level to set',
                    type: 4, // INTEGER
                    required: true,
                    min_value: 1,
                },
            ],
        },
        {
            name: 'resetxp',
            description: 'Reset a user\'s XP and level (Admin only)',
            controller: 'LevelingController',
            method: 'resetxp',
            options: [
                {
                    name: 'user',
                    description: 'User to reset XP for',
                    type: 6, // USER
                    required: true,
                },
            ],
        },
    ],
};
