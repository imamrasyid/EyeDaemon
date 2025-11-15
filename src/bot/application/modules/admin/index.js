/**
 * Admin Module Definition
 * 
 * Defines the admin module structure with all commands and their mappings
 * to the AdminController methods
 */

module.exports = {
    name: 'Admin',
    description: 'Administrative commands and system management',
    version: '1.0.0',

    // Controllers used by this module
    controllers: ['AdminController'],

    // Models used by this module
    models: ['GuildModel'],

    // Libraries used by this module
    libraries: [],

    // Services used by this module
    services: ['GuildConfigService', 'PerformanceService'],

    // Command definitions with Discord slash command structure
    commands: [
        {
            name: 'config',
            description: 'Manage guild configuration',
            controller: 'AdminController',
            method: 'config',
            options: [
                {
                    name: 'view',
                    description: 'View current configuration',
                    type: 1, // SUB_COMMAND
                },
                {
                    name: 'set',
                    description: 'Set a configuration value',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'setting',
                            description: 'Setting to configure',
                            type: 3, // STRING
                            required: true,
                        },
                        {
                            name: 'value',
                            description: 'Value to set',
                            type: 3, // STRING
                            required: true,
                        },
                    ],
                },
                {
                    name: 'reset',
                    description: 'Reset a setting to default',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'setting',
                            description: 'Setting to reset',
                            type: 3, // STRING
                            required: true,
                        },
                    ],
                },
                {
                    name: 'list',
                    description: 'List all available settings',
                    type: 1, // SUB_COMMAND
                },
            ],
        },
        {
            name: 'performance',
            description: 'View bot performance metrics',
            controller: 'AdminController',
            method: 'performance',
            options: [],
        },
        {
            name: 'health',
            description: 'Check bot and database health status',
            controller: 'AdminController',
            method: 'health',
            options: [],
        },
    ],
};
