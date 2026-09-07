'use strict';

const { Collection } = require('discord.js');
const DatabaseLibrary = require('../bot/system/libraries/Database');
const MigrationManager = require('../bot/system/database/MigrationManager');
const GuildConfigService = require('../bot/application/modules/admin/services/GuildConfigService');
const AdminController = require('../bot/application/controllers/AdminController');

function createMockInteraction(overrides = {}) {
    return {
        id: 'interaction-test',
        commandName: overrides.commandName || 'test',
        user: { id: 'u-1', tag: 'TestUser#0001', username: 'TestUser', bot: false },
        member: {
            id: 'u-1',
            user: { id: 'u-1', tag: 'TestUser#0001', username: 'TestUser', bot: false },
            permissions: { has: jest.fn().mockReturnValue(true) },
            roles: { cache: new Collection() },
        },
        guild: overrides.guild || {
            id: 'guild-1',
            name: 'Test Guild',
            memberCount: 50,
            members: {
                me: { permissions: { has: () => true } },
                cache: new Collection(),
            },
            channels: {
                cache: new Collection([
                    ['chan-log', { id: 'chan-log', name: 'audit-log', type: 0 }],
                ]),
            },
            roles: {
                cache: new Collection([
                    ['role-admin', { id: 'role-admin', name: 'Admin' }],
                    ['role-mod', { id: 'role-mod', name: 'Moderator' }],
                    ['role-dj', { id: 'role-dj', name: 'DJ' }],
                ]),
            },
        },
        channel: { id: 'chan-1', name: 'general', send: jest.fn().mockResolvedValue({}) },
        options: {
            getString: jest.fn((name) => overrides.stringOptions?.[name] ?? null),
            getChannel: jest.fn((name) => overrides.channelOptions?.[name] ?? null),
            getRole: jest.fn((name) => overrides.roleOptions?.[name] ?? null),
            getSubcommand: jest.fn(() => overrides.subcommand ?? null),
        },
        deferred: false,
        replied: false,
        reply: jest.fn().mockImplementation(async function () { this.replied = true; }),
        deferReply: jest.fn().mockImplementation(async function () { this.deferred = true; }),
        editReply: jest.fn().mockImplementation(async function () { return {}; }),
        followUp: jest.fn().mockImplementation(async function () { return {}; }),
        ...overrides,
    };
}

describe('Phase 5: Validation & Integration', () => {
    let db;
    let mockClient;

    beforeAll(async () => {
        db = new DatabaseLibrary(null, {
            url: 'file::memory:?cache=shared',
            enablePerformanceLogging: false,
            enableMetricsTracking: false,
        });

        await db.connect();
        const mm = new MigrationManager(db);
        await mm.runMigrations();

        const now = Math.floor(Date.now() / 1000);
        await db.query(
            'INSERT INTO guilds (guild_id, name, config_json, prefix, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            ['guild-1', 'Phase5 Guild', JSON.stringify({}), '!', now, now]
        );

        const guildsCollection = new Collection();
        guildsCollection.set('guild-1', {
            id: 'guild-1',
            name: 'Phase5 Guild',
            memberCount: 50,
            channels: {
                cache: new Collection([
                    ['chan-log', { id: 'chan-log', name: 'audit-log', type: 0 }],
                ]),
            },
            roles: {
                cache: new Collection([
                    ['role-admin', { id: 'role-admin', name: 'Admin' }],
                    ['role-mod', { id: 'role-mod', name: 'Moderator' }],
                    ['role-dj', { id: 'role-dj', name: 'DJ' }],
                ]),
            },
            members: { cache: new Collection() },
        });

        const modulesMap = new Map();
        const servicesMap = new Map();

        mockClient = {
            database: db,
            db: db,
            modules: modulesMap,
            services: servicesMap,
            logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
            guilds: { cache: guildsCollection },
            users: { cache: new Collection() },
            channels: { cache: new Collection() },
            ws: { ping: 20 },
        };
    });

    describe('GuildConfigService Validation', () => {
        let configService;

        beforeAll(async () => {
            configService = new GuildConfigService(mockClient);
            await configService.initialize();
        });

        test('boolean validation accepts lowercase true/false', async () => {
            await expect(configService.setSetting('guild-1', 'welcome_enabled', 'true')).resolves.not.toThrow();
            const val = await configService.getSetting('guild-1', 'welcome_enabled');
            expect(val).toBe(true);
        });

        test('boolean validation accepts uppercase True/False', async () => {
            await expect(configService.setSetting('guild-1', 'welcome_enabled', 'True')).resolves.not.toThrow();
            const val = await configService.getSetting('guild-1', 'welcome_enabled');
            expect(val).toBe(true);
        });

        test('boolean validation accepts mixed case', async () => {
            await expect(configService.setSetting('guild-1', 'logging_enabled', 'TRUE')).resolves.not.toThrow();
            const val = await configService.getSetting('guild-1', 'logging_enabled');
            expect(val).toBe(true);
        });

        test('boolean validation rejects invalid strings', async () => {
            await expect(configService.setSetting('guild-1', 'welcome_enabled', 'yes')).rejects.toThrow('Invalid value');
            await expect(configService.setSetting('guild-1', 'welcome_enabled', '1')).rejects.toThrow('Invalid value');
            await expect(configService.setSetting('guild-1', 'welcome_enabled', '')).rejects.toThrow('Invalid value');
        });

        test('boolean validation accepts actual booleans', async () => {
            await expect(configService.setSetting('guild-1', 'welcome_enabled', false)).resolves.not.toThrow();
            const val = await configService.getSetting('guild-1', 'welcome_enabled');
            expect(val).toBe(false);
        });

        test('number validation enforces range for volume_default', async () => {
            await expect(configService.setSetting('guild-1', 'volume_default', 100)).resolves.not.toThrow();
            await expect(configService.setSetting('guild-1', 'volume_default', 0)).resolves.not.toThrow();
            await expect(configService.setSetting('guild-1', 'volume_default', 200)).resolves.not.toThrow();
            await expect(configService.setSetting('guild-1', 'volume_default', -1)).rejects.toThrow('Invalid value');
            await expect(configService.setSetting('guild-1', 'volume_default', 201)).rejects.toThrow('Invalid value');
        });

        test('number validation enforces range for max_queue_size', async () => {
            await expect(configService.setSetting('guild-1', 'max_queue_size', 1)).resolves.not.toThrow();
            await expect(configService.setSetting('guild-1', 'max_queue_size', 500)).resolves.not.toThrow();
            await expect(configService.setSetting('guild-1', 'max_queue_size', 0)).rejects.toThrow('Invalid value');
            await expect(configService.setSetting('guild-1', 'max_queue_size', 501)).rejects.toThrow('Invalid value');
        });

        test('number validation enforces range for leveling_xp_multiplier', async () => {
            await expect(configService.setSetting('guild-1', 'leveling_xp_multiplier', 0.1)).resolves.not.toThrow();
            await expect(configService.setSetting('guild-1', 'leveling_xp_multiplier', 10.0)).resolves.not.toThrow();
            await expect(configService.setSetting('guild-1', 'leveling_xp_multiplier', 0.05)).rejects.toThrow('Invalid value');
            await expect(configService.setSetting('guild-1', 'leveling_xp_multiplier', 10.1)).rejects.toThrow('Invalid value');
        });

        test('number validation enforces range for economy_starting_balance', async () => {
            await expect(configService.setSetting('guild-1', 'economy_starting_balance', 0)).resolves.not.toThrow();
            await expect(configService.setSetting('guild-1', 'economy_starting_balance', 1000000)).resolves.not.toThrow();
            await expect(configService.setSetting('guild-1', 'economy_starting_balance', -1)).rejects.toThrow('Invalid value');
            await expect(configService.setSetting('guild-1', 'economy_starting_balance', 1000001)).rejects.toThrow('Invalid value');
        });

        test('enum validation enforces logging_events values', async () => {
            await expect(configService.setSetting('guild-1', 'logging_events', 'all')).resolves.not.toThrow();
            await expect(configService.setSetting('guild-1', 'logging_events', 'moderation')).resolves.not.toThrow();
            await expect(configService.setSetting('guild-1', 'logging_events', 'joins')).resolves.not.toThrow();
            await expect(configService.setSetting('guild-1', 'logging_events', 'none')).resolves.not.toThrow();
            await expect(configService.setSetting('guild-1', 'logging_events', 'invalid')).rejects.toThrow('Invalid value');
        });

        test('channel validation accepts null to clear', async () => {
            await expect(configService.setSetting('guild-1', 'logging_channel', null)).resolves.not.toThrow();
            const val = await configService.getSetting('guild-1', 'logging_channel');
            expect(val).toBeNull();
        });

        test('channel validation accepts valid channel from guild cache', async () => {
            await expect(configService.setSetting('guild-1', 'logging_channel', 'chan-log')).resolves.not.toThrow();
            const val = await configService.getSetting('guild-1', 'logging_channel');
            expect(val).toBe('chan-log');
        });

        test('channel validation rejects nonexistent channel', async () => {
            await expect(configService.setSetting('guild-1', 'logging_channel', 'nonexistent-channel')).rejects.toThrow('Invalid value');
        });

        test('role validation accepts valid role from guild cache', async () => {
            await expect(configService.setSetting('guild-1', 'admin_role', 'role-admin')).resolves.not.toThrow();
            const val = await configService.getSetting('guild-1', 'admin_role');
            expect(val).toBe('role-admin');
        });

        test('role validation rejects nonexistent role', async () => {
            await expect(configService.setSetting('guild-1', 'admin_role', 'nonexistent-role')).rejects.toThrow('Invalid value');
        });

        test('unknown setting throws error', async () => {
            await expect(configService.setSetting('guild-1', 'nonexistent_setting', 'value')).rejects.toThrow('Unknown setting');
        });

        test('resetSetting restores default value', async () => {
            await configService.setSetting('guild-1', 'volume_default', 50);
            const before = await configService.getSetting('guild-1', 'volume_default');
            expect(before).toBe(50);

            await configService.resetSetting('guild-1', 'volume_default');
            const after = await configService.getSetting('guild-1', 'volume_default');
            expect(after).toBe(80);
        });

        test('getDefaults returns all 25 settings', () => {
            const defaults = configService.getDefaults();
            expect(Object.keys(defaults).length).toBe(25);
            expect(defaults.prefix).toBe('!');
            expect(defaults.volume_default).toBe(80);
            expect(defaults.welcome_enabled).toBe(false);
            expect(defaults.features_music).toBe(true);
            expect(defaults.logging_enabled).toBe(false);
            expect(defaults.features_tickets).toBe(true);
        });

        test('listAvailableSettings returns all settings grouped by category', () => {
            const settings = configService.listAvailableSettings();
            expect(settings.general).toBeDefined();
            expect(settings.music).toBeDefined();
            expect(settings.welcome).toBeDefined();
            expect(settings.logging).toBeDefined();
            expect(settings.roles).toBeDefined();
            expect(settings.features).toBeDefined();
            expect(settings.leveling).toBeDefined();
            expect(settings.economy).toBeDefined();

            let total = 0;
            for (const category of Object.values(settings)) {
                total += category.length;
            }
            expect(total).toBe(25);
        });

        test('cache works correctly', async () => {
            configService.cache.clear();
            configService.resetCacheStats();

            await configService.getGuildConfig('guild-1');
            const statsAfterFirst = configService.getCacheStats();
            expect(statsAfterFirst.misses).toBe(1);
            expect(statsAfterFirst.hits).toBe(0);

            await configService.getGuildConfig('guild-1');
            const statsAfterSecond = configService.getCacheStats();
            expect(statsAfterSecond.hits).toBe(1);
            expect(statsAfterSecond.misses).toBe(1);
        });
    });

    describe('AdminController New Handlers', () => {
        let controller;

        beforeAll(async () => {
            const configService = new GuildConfigService(mockClient);
            await configService.initialize();
            mockClient.services.set('GuildConfigService', configService);

            const perfService = { getSystemMetrics: () => ({ memory: {}, cpu: {} }), getBotMetrics: () => ({ guilds: {} }) };
            mockClient.services.set('PerformanceService', perfService);

            controller = new AdminController(mockClient);
        });

        describe('LoggingHandler', () => {
            test('/logs view', async () => {
                const interaction = createMockInteraction({ subcommand: 'view' });
                await controller.logs(interaction);
                expect(interaction.deferReply).toHaveBeenCalled();
            });

            test('/logs channel', async () => {
                const interaction = createMockInteraction({
                    subcommand: 'channel',
                    channelOptions: { channel: { id: 'chan-log', name: 'audit-log', type: 0 } },
                });
                await controller.logs(interaction);
                expect(interaction.deferReply).toHaveBeenCalled();
            });

            test('/logs events', async () => {
                const interaction = createMockInteraction({
                    subcommand: 'events',
                    stringOptions: { scope: 'moderation' },
                });
                await controller.logs(interaction);
                expect(interaction.deferReply).toHaveBeenCalled();
            });
        });

        describe('RolesHandler', () => {
            test('/roles view', async () => {
                const interaction = createMockInteraction({ subcommand: 'view' });
                await controller.roles(interaction);
                expect(interaction.deferReply).toHaveBeenCalled();
            });

            test('/roles admin', async () => {
                const interaction = createMockInteraction({
                    subcommand: 'admin',
                    roleOptions: { role: { id: 'role-admin', name: 'Admin' } },
                });
                await controller.roles(interaction);
                expect(interaction.deferReply).toHaveBeenCalled();
            });

            test('/roles moderator', async () => {
                const interaction = createMockInteraction({
                    subcommand: 'moderator',
                    roleOptions: { role: { id: 'role-mod', name: 'Moderator' } },
                });
                await controller.roles(interaction);
                expect(interaction.deferReply).toHaveBeenCalled();
            });

            test('/roles dj', async () => {
                const interaction = createMockInteraction({
                    subcommand: 'dj',
                    roleOptions: { role: { id: 'role-dj', name: 'DJ' } },
                });
                await controller.roles(interaction);
                expect(interaction.deferReply).toHaveBeenCalled();
            });
        });

        describe('FeaturesHandler', () => {
            test('/features view', async () => {
                const interaction = createMockInteraction({ subcommand: 'view' });
                await controller.features(interaction);
                expect(interaction.deferReply).toHaveBeenCalled();
            });

            test('/features toggle music', async () => {
                const interaction = createMockInteraction({
                    subcommand: 'toggle',
                    stringOptions: { module: 'music' },
                });
                await controller.features(interaction);
                expect(interaction.deferReply).toHaveBeenCalled();
            });

            test('/features toggle invalid module', async () => {
                const interaction = createMockInteraction({
                    subcommand: 'toggle',
                    stringOptions: { module: 'invalid' },
                });
                await controller.features(interaction);
                expect(interaction.deferReply).toHaveBeenCalled();
            });
        });

        describe('BotHandler', () => {
            test('/bot status', async () => {
                const interaction = createMockInteraction({ subcommand: 'status' });
                await controller.bot(interaction);
                expect(interaction.deferReply).toHaveBeenCalled();
            });

            test('/bot diagnostics', async () => {
                const interaction = createMockInteraction({ subcommand: 'diagnostics' });
                await controller.bot(interaction);
                expect(interaction.deferReply).toHaveBeenCalled();
            });
        });
    });

    describe('ConfigHandler Error Paths', () => {
        let controller;

        beforeAll(async () => {
            const configService = new GuildConfigService(mockClient);
            await configService.initialize();
            mockClient.services.set('GuildConfigService', configService);

            const perfService = { getSystemMetrics: () => ({ memory: {}, cpu: {} }), getBotMetrics: () => ({ guilds: {} }) };
            mockClient.services.set('PerformanceService', perfService);

            controller = new AdminController(mockClient);
        });

        test('/config set with invalid setting name', async () => {
            const interaction = createMockInteraction({
                subcommand: 'set',
                stringOptions: { setting: 'nonexistent_setting', value: '100' },
            });
            await controller.config(interaction);
            expectResponded(interaction);
        });

        test('/config set with out-of-range value', async () => {
            const interaction = createMockInteraction({
                subcommand: 'set',
                stringOptions: { setting: 'volume_default', value: '999' },
            });
            await controller.config(interaction);
            expectResponded(interaction);
        });

        test('/config reset restores default', async () => {
            const interaction = createMockInteraction({
                subcommand: 'set',
                stringOptions: { setting: 'volume_default', value: '50' },
            });
            await controller.config(interaction);

            const resetInteraction = createMockInteraction({
                subcommand: 'reset',
                stringOptions: { setting: 'volume_default' },
            });
            await controller.config(resetInteraction);
            expectResponded(resetInteraction);
        });
    });
});

function expectResponded(interaction) {
    const totalCalls =
        interaction.reply.mock.calls.length +
        interaction.deferReply.mock.calls.length +
        interaction.editReply.mock.calls.length +
        interaction.followUp.mock.calls.length;
    expect(totalCalls).toBeGreaterThan(0);
}
