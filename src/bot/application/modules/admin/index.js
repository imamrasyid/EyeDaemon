'use strict';

/**
 * Admin Module Definition
 *
 * Defines the admin module structure with all commands and their mappings
 * to the AdminController methods.
 *
 * Security: All admin commands require Administrator permission and are
 * restricted to guild contexts only via default_member_permissions and contexts.
 */

const {
    PermissionFlagsBits,
    InteractionContextType,
    ApplicationIntegrationType,
} = require('discord.js');

const COMMAND_TYPES = {
    SUB_COMMAND: 1,
    STRING: 3,
    CHANNEL: 7,
    ROLE: 8,
};

const ADMIN_PERMISSIONS = PermissionFlagsBits.Administrator;
const GUILD_CONTEXT = [InteractionContextType.Guild];
const GUILD_INSTALL = [ApplicationIntegrationType.GuildInstall];

module.exports = {
    name: 'Admin',
    description: 'Administrative commands and system management',
    version: '3.0.0',

    controllers: ['AdminController'],
    libraries: [],
    services: ['GuildConfigService', 'PerformanceService'],

    commands: [
        {
            name: 'config',
            description: 'Manage guild configuration',
            controller: 'AdminController',
            method: 'config',
            defaultMemberPermissions: ADMIN_PERMISSIONS,
            contexts: GUILD_CONTEXT,
            integrationTypes: GUILD_INSTALL,
            options: [
                {
                    name: 'view',
                    description: 'View current configuration',
                    type: COMMAND_TYPES.SUB_COMMAND,
                },
                {
                    name: 'set',
                    description: 'Set a configuration value',
                    type: COMMAND_TYPES.SUB_COMMAND,
                    options: [
                        { name: 'setting', description: 'Setting to configure', type: COMMAND_TYPES.STRING, required: true },
                        { name: 'value', description: 'Value to set', type: COMMAND_TYPES.STRING, required: true },
                    ],
                },
                {
                    name: 'reset',
                    description: 'Reset a setting to default',
                    type: COMMAND_TYPES.SUB_COMMAND,
                    options: [
                        { name: 'setting', description: 'Setting to reset', type: COMMAND_TYPES.STRING, required: true },
                    ],
                },
                {
                    name: 'list',
                    description: 'List all available settings',
                    type: COMMAND_TYPES.SUB_COMMAND,
                },
            ],
        },
        {
            name: 'logs',
            description: 'Configure event logging',
            controller: 'AdminController',
            method: 'logs',
            defaultMemberPermissions: ADMIN_PERMISSIONS,
            contexts: GUILD_CONTEXT,
            integrationTypes: GUILD_INSTALL,
            options: [
                {
                    name: 'view',
                    description: 'View current logging configuration',
                    type: COMMAND_TYPES.SUB_COMMAND,
                },
                {
                    name: 'channel',
                    description: 'Set the logging channel',
                    type: COMMAND_TYPES.SUB_COMMAND,
                    options: [
                        { name: 'channel', description: 'Channel for event logs', type: COMMAND_TYPES.CHANNEL, required: true },
                    ],
                },
                {
                    name: 'events',
                    description: 'Set which events to log',
                    type: COMMAND_TYPES.SUB_COMMAND,
                    options: [
                        {
                            name: 'scope',
                            description: 'Events to log',
                            type: COMMAND_TYPES.STRING,
                            required: true,
                            choices: [
                                { name: 'All events', value: 'all' },
                                { name: 'Moderation only', value: 'moderation' },
                                { name: 'Joins only', value: 'joins' },
                                { name: 'None (disable)', value: 'none' },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            name: 'roles',
            description: 'Configure bot role assignments',
            controller: 'AdminController',
            method: 'roles',
            defaultMemberPermissions: ADMIN_PERMISSIONS,
            contexts: GUILD_CONTEXT,
            integrationTypes: GUILD_INSTALL,
            options: [
                {
                    name: 'view',
                    description: 'View current role configuration',
                    type: COMMAND_TYPES.SUB_COMMAND,
                },
                {
                    name: 'admin',
                    description: 'Set the admin role',
                    type: COMMAND_TYPES.SUB_COMMAND,
                    options: [
                        { name: 'role', description: 'Role for admin permissions', type: COMMAND_TYPES.ROLE, required: true },
                    ],
                },
                {
                    name: 'moderator',
                    description: 'Set the moderator role',
                    type: COMMAND_TYPES.SUB_COMMAND,
                    options: [
                        { name: 'role', description: 'Role for moderation permissions', type: COMMAND_TYPES.ROLE, required: true },
                    ],
                },
                {
                    name: 'dj',
                    description: 'Set the DJ role for music commands',
                    type: COMMAND_TYPES.SUB_COMMAND,
                    options: [
                        { name: 'role', description: 'Role for DJ permissions', type: COMMAND_TYPES.ROLE, required: true },
                    ],
                },
            ],
        },
        {
            name: 'features',
            description: 'Enable or disable bot modules',
            controller: 'AdminController',
            method: 'features',
            defaultMemberPermissions: ADMIN_PERMISSIONS,
            contexts: GUILD_CONTEXT,
            integrationTypes: GUILD_INSTALL,
            options: [
                {
                    name: 'view',
                    description: 'View all feature toggles',
                    type: COMMAND_TYPES.SUB_COMMAND,
                },
                {
                    name: 'toggle',
                    description: 'Toggle a module on or off',
                    type: COMMAND_TYPES.SUB_COMMAND,
                    options: [
                        {
                            name: 'module',
                            description: 'Module to toggle',
                            type: COMMAND_TYPES.STRING,
                            required: true,
                            choices: [
                                { name: '🎵 Music', value: 'music' },
                                { name: '🛡️ Moderation', value: 'moderation' },
                                { name: '💰 Economy', value: 'economy' },
                                { name: '📈 Leveling', value: 'leveling' },
                                { name: '🎫 Tickets', value: 'ticket' },
                                { name: '📝 Logging', value: 'logging' },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            name: 'bot',
            description: 'Bot status and diagnostics',
            controller: 'AdminController',
            method: 'bot',
            defaultMemberPermissions: ADMIN_PERMISSIONS,
            contexts: GUILD_CONTEXT,
            integrationTypes: GUILD_INSTALL,
            options: [
                {
                    name: 'status',
                    description: 'Show bot status overview',
                    type: COMMAND_TYPES.SUB_COMMAND,
                },
                {
                    name: 'diagnostics',
                    description: 'Show detailed diagnostics',
                    type: COMMAND_TYPES.SUB_COMMAND,
                },
            ],
        },
        {
            name: 'performance',
            description: 'View bot performance metrics',
            controller: 'AdminController',
            method: 'performance',
            defaultMemberPermissions: ADMIN_PERMISSIONS,
            contexts: GUILD_CONTEXT,
            integrationTypes: GUILD_INSTALL,
            options: [],
        },
        {
            name: 'health',
            description: 'Check bot and database health status',
            controller: 'AdminController',
            method: 'health',
            defaultMemberPermissions: ADMIN_PERMISSIONS,
            contexts: GUILD_CONTEXT,
            integrationTypes: GUILD_INSTALL,
            options: [],
        },
    ],
};
