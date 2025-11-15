/**
 * Utility Module Definition
 * 
 * Defines the utility module structure with all commands and their mappings
 * to the UtilityController methods
 */

module.exports = {
    name: 'Utility',
    description: 'Server management and utility features',
    version: '1.0.0',

    // Controllers used by this module
    controllers: ['UtilityController'],

    // Models used by this module
    models: ['UtilityModel'],

    // Libraries used by this module
    libraries: [],

    // Command definitions with Discord slash command structure
    commands: [
        {
            name: 'help',
            description: 'Display bot commands and features',
            controller: 'UtilityController',
            method: 'help',
            options: [],
        },
        {
            name: 'stats',
            description: 'Display bot or guild statistics (role-based)',
            controller: 'UtilityController',
            method: 'stats',
            options: [],
        },
        // Note: Welcome and goodbye configuration moved to /config command in admin module
        // Use: /config set welcome_enabled true
        //      /config set welcome_channel #channel
        //      /config set welcome_message "Your message"
        //      /config set goodbye_enabled true
        //      /config set goodbye_channel #channel
        //      /config set goodbye_message "Your message"
    ],
};
