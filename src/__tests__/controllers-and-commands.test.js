'use strict';

const { Collection } = require('discord.js');
const DatabaseLibrary = require('../bot/system/libraries/Database');
const MigrationManager = require('../bot/system/database/MigrationManager');
const AdminController = require('../bot/application/controllers/AdminController');
const EconomyController = require('../bot/application/controllers/EconomyController');
const LevelingController = require('../bot/application/controllers/LevelingController');
const ModerationController = require('../bot/application/controllers/ModerationController');
const MusicController = require('../bot/application/controllers/MusicController');
const TicketController = require('../bot/application/controllers/TicketController');
const UtilityController = require('../bot/application/controllers/UtilityController');

function createMockInteraction(overrides = {}) {
    const interaction = {
        id: 'interaction-123',
        commandName: overrides.commandName || 'test',
        user: overrides.user || { id: 'u-1', tag: 'TestUser#0001', username: 'TestUser', bot: false },
        member: overrides.member || {
            id: 'u-1',
            user: { id: 'u-1', tag: 'TestUser#0001', username: 'TestUser', bot: false },
            permissions: { has: jest.fn().mockReturnValue(true) },
            roles: { cache: new Collection() },
            voice: {
                channel: {
                    id: 'voice-1',
                    name: 'Voice',
                    joinable: true,
                    permissionsFor: jest.fn().mockReturnValue({ has: () => true })
                }
            }
        },
        guild: overrides.guild || {
            id: 'guild-1',
            name: 'Test Guild',
            members: {
                me: { permissions: { has: () => true } },
                cache: new Collection([
                    ['u-1', { id: 'u-1', user: { bot: false }, permissions: { has: () => true }, roles: { cache: new Collection() } }],
                    ['u-target', { id: 'u-target', user: { bot: false }, timeout: jest.fn().mockResolvedValue({}), kick: jest.fn().mockResolvedValue({}), ban: jest.fn().mockResolvedValue({}) }]
                ]),
                fetch: jest.fn().mockImplementation(async (id) => ({
                    id,
                    user: { id, bot: false },
                    timeout: jest.fn().mockResolvedValue({}),
                    kick: jest.fn().mockResolvedValue({}),
                    ban: jest.fn().mockResolvedValue({})
                }))
            },
            channels: {
                cache: new Collection([
                    ['chan-1', { id: 'chan-1', name: 'general', type: 0, permissionsFor: () => ({ has: () => true }), send: jest.fn().mockResolvedValue({}) }]
                ]),
                create: jest.fn().mockResolvedValue({ id: 'chan-ticket-1', send: jest.fn().mockResolvedValue({}) })
            },
            bans: {
                create: jest.fn().mockResolvedValue({}),
                remove: jest.fn().mockResolvedValue({})
            },
            roles: {
                cache: new Collection([['role-1', { id: 'role-1', name: 'Member' }]])
            }
        },
        channel: overrides.channel || {
            id: 'chan-1',
            name: 'general',
            send: jest.fn().mockResolvedValue({}),
            bulkDelete: jest.fn().mockResolvedValue(new Collection([['msg-1', {}]]))
        },
        options: {
            getString: jest.fn((name) => overrides.stringOptions?.[name] ?? null),
            getInteger: jest.fn((name) => overrides.intOptions?.[name] ?? null),
            getBoolean: jest.fn((name) => overrides.boolOptions?.[name] ?? null),
            getUser: jest.fn((name) => overrides.userOptions?.[name] ?? null),
            getMember: jest.fn((name) => overrides.userOptions?.[name] ?? null),
            getSubcommand: jest.fn(() => overrides.subcommand ?? null),
        },
        deferred: false,
        replied: false,
        reply: jest.fn().mockImplementation(async function(payload) { this.replied = true; return payload; }),
        deferReply: jest.fn().mockImplementation(async function(payload) { this.deferred = true; return payload; }),
        editReply: jest.fn().mockImplementation(async function(payload) { return payload; }),
        followUp: jest.fn().mockImplementation(async function(payload) { return payload; }),
        ...overrides
    };

    return interaction;
}

function expectResponded(interaction) {
    const totalCalls =
        interaction.reply.mock.calls.length +
        interaction.deferReply.mock.calls.length +
        interaction.editReply.mock.calls.length +
        interaction.followUp.mock.calls.length;
    expect(totalCalls).toBeGreaterThan(0);
}

describe('Controllers and Command Handlers Suite', () => {
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
            ['guild-1', 'Controller Guild', JSON.stringify({ welcome_enabled: true }), '!', now, now]
        );

        for (const u of ['u-1', 'u-target']) {
            await db.query(
                'INSERT INTO user_profiles (user_id, username, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO NOTHING',
                [u, `User_${u}`, now, now]
            );
        }

        const modulesMap = new Map();
        const servicesMap = new Map();

        mockClient = {
            database: db,
            db: db,
            modules: modulesMap,
            services: servicesMap,
            logger: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
            },
            guilds: {
                cache: new Collection([
                    ['guild-1', {
                        id: 'guild-1',
                        name: 'Controller Guild',
                        memberCount: 50,
                        members: { cache: new Collection() },
                        channels: { cache: new Collection() },
                        roles: { cache: new Collection() }
                    }]
                ])
            },
            users: { cache: new Collection() },
            channels: { cache: new Collection() },
            ws: { ping: 20 }
        };
    });

    describe('AdminController (3 Commands)', () => {
        let controller;

        beforeAll(() => {
            controller = new AdminController(mockClient);
        });

        test('/config view', async () => {
            const interaction = createMockInteraction({ subcommand: 'view' });
            await controller.config(interaction);
            expectResponded(interaction);
        });

        test('/config set', async () => {
            const interaction = createMockInteraction({
                subcommand: 'set',
                stringOptions: { setting: 'volume_default', value: '75' }
            });
            await controller.config(interaction);
            expectResponded(interaction);
        });

        test('/config list', async () => {
            const interaction = createMockInteraction({ subcommand: 'list' });
            await controller.config(interaction);
            expectResponded(interaction);
        });

        test('/performance', async () => {
            const interaction = createMockInteraction();
            await controller.performance(interaction);
            expectResponded(interaction);
        });

        test('/health', async () => {
            const interaction = createMockInteraction();
            await controller.health(interaction);
            expectResponded(interaction);
        });
    });

    describe('EconomyController (10 Commands)', () => {
        let controller;

        beforeAll(() => {
            controller = new EconomyController(mockClient);
        });

        test('/balance', async () => {
            const interaction = createMockInteraction();
            await controller.balance(interaction);
            expectResponded(interaction);
        });

        test('/daily', async () => {
            const interaction = createMockInteraction();
            await controller.daily(interaction);
            expectResponded(interaction);
        });

        test('/work', async () => {
            const interaction = createMockInteraction();
            await controller.work(interaction);
            expectResponded(interaction);
        });

        test('/transfer', async () => {
            const interaction = createMockInteraction({
                userOptions: { user: { id: 'u-target', tag: 'Target#0002' } },
                intOptions: { amount: 50 }
            });
            await controller.transfer(interaction);
            expectResponded(interaction);
        });

        test('/deposit and /withdraw', async () => {
            const depInteraction = createMockInteraction({ intOptions: { amount: 25 } });
            await controller.deposit(depInteraction);
            expectResponded(depInteraction);

            const withInteraction = createMockInteraction({ intOptions: { amount: 25 } });
            await controller.withdraw(withInteraction);
            expectResponded(withInteraction);
        });

        test('/blackjack', async () => {
            const interaction = createMockInteraction({ intOptions: { bet: 20 } });
            await controller.blackjack(interaction);
            expectResponded(interaction);
        });

        test('/shop, /shop-buy, and /inventory', async () => {
            const shopInt = createMockInteraction();
            await controller.shop(shopInt);
            expectResponded(shopInt);

            const invInt = createMockInteraction();
            await controller.inventory(invInt);
            expectResponded(invInt);
        });
    });

    describe('LevelingController (6 Commands)', () => {
        let controller;

        beforeAll(() => {
            controller = new LevelingController(mockClient);
        });

        test('/rank', async () => {
            const interaction = createMockInteraction();
            await controller.rank(interaction);
            expectResponded(interaction);
        });

        test('/leaderboard', async () => {
            const interaction = createMockInteraction({ stringOptions: { type: 'xp' } });
            await controller.leaderboard(interaction);
            expectResponded(interaction);
        });

        test('/givexp and /removexp', async () => {
            const giveInt = createMockInteraction({
                userOptions: { user: { id: 'u-target', tag: 'Target#0002' } },
                intOptions: { amount: 100 }
            });
            await controller.givexp(giveInt);
            expectResponded(giveInt);

            const removeInt = createMockInteraction({
                userOptions: { user: { id: 'u-target', tag: 'Target#0002' } },
                intOptions: { amount: 50 }
            });
            await controller.removexp(removeInt);
            expectResponded(removeInt);
        });

        test('/setlevel and /resetxp', async () => {
            const setInt = createMockInteraction({
                userOptions: { user: { id: 'u-target', tag: 'Target#0002' } },
                intOptions: { level: 5 }
            });
            await controller.setlevel(setInt);
            expectResponded(setInt);

            const resetInt = createMockInteraction({
                userOptions: { user: { id: 'u-target', tag: 'Target#0002' } }
            });
            await controller.resetxp(resetInt);
            expectResponded(resetInt);
        });
    });

    describe('ModerationController (7 Commands)', () => {
        let controller;

        beforeAll(() => {
            controller = new ModerationController(mockClient);
        });

        test('/warn and /warnings', async () => {
            const warnInt = createMockInteraction({
                userOptions: { user: { id: 'u-target', tag: 'Target#0002' } },
                stringOptions: { reason: 'Test warning reason' }
            });
            await controller.warn(warnInt);
            expectResponded(warnInt);

            const warningsInt = createMockInteraction({
                userOptions: { user: { id: 'u-target', tag: 'Target#0002' } }
            });
            await controller.warnings(warningsInt);
            expectResponded(warningsInt);
        });

        test('/kick and /ban and /unban', async () => {
            const kickInt = createMockInteraction({
                userOptions: { user: { id: 'u-target', tag: 'Target#0002' } },
                stringOptions: { reason: 'Test kick' }
            });
            await controller.kick(kickInt);
            expectResponded(kickInt);

            const banInt = createMockInteraction({
                userOptions: { user: { id: 'u-target', tag: 'Target#0002' } },
                stringOptions: { reason: 'Test ban' }
            });
            await controller.ban(banInt);
            expectResponded(banInt);

            const unbanInt = createMockInteraction({
                stringOptions: { user_id: 'u-target', reason: 'Forgiven' }
            });
            await controller.unban(unbanInt);
            expectResponded(unbanInt);
        });

        test('/timeout and /purge', async () => {
            const timeoutInt = createMockInteraction({
                userOptions: { user: { id: 'u-target', tag: 'Target#0002' } },
                intOptions: { duration: 10 },
                stringOptions: { reason: 'Cool down' }
            });
            await controller.timeout(timeoutInt);
            expectResponded(timeoutInt);

            const purgeInt = createMockInteraction({
                intOptions: { amount: 10 }
            });
            await controller.purge(purgeInt);
            expectResponded(purgeInt);
        });
    });

    describe('MusicController (21 Commands)', () => {
        let controller;

        beforeAll(() => {
            controller = new MusicController(mockClient);
        });

        test('playback commands (play, pause, resume, skip, stop)', async () => {
            const playInt = createMockInteraction({ stringOptions: { query: 'test song' } });
            await controller.play(playInt);
            expectResponded(playInt);

            const pauseInt = createMockInteraction();
            await controller.pause(pauseInt);
            expectResponded(pauseInt);

            const resumeInt = createMockInteraction();
            await controller.resume(resumeInt);
            expectResponded(resumeInt);

            const skipInt = createMockInteraction();
            await controller.skip(skipInt);
            expectResponded(skipInt);

            const stopInt = createMockInteraction();
            await controller.stop(stopInt);
            expectResponded(stopInt);
        });

        test('queue & settings commands (queue, nowplaying, volume, loop, shuffle, filter)', async () => {
            const queueInt = createMockInteraction();
            await controller.queue(queueInt);
            expectResponded(queueInt);

            const npInt = createMockInteraction();
            await controller.nowplaying(npInt);
            expectResponded(npInt);

            const volInt = createMockInteraction({ intOptions: { level: 80 } });
            await controller.volume(volInt);
            expectResponded(volInt);

            const loopInt = createMockInteraction({ stringOptions: { mode: 'track' } });
            await controller.loop(loopInt);
            expectResponded(loopInt);

            const filterInt = createMockInteraction({ stringOptions: { type: 'bassboost' } });
            await controller.filter(filterInt);
            expectResponded(filterInt);
        });

        test('playlist commands (playlist-create, playlist-list)', async () => {
            const createInt = createMockInteraction({ stringOptions: { name: 'My Party List' } });
            await controller.playlistCreate(createInt);
            expectResponded(createInt);

            const listInt = createMockInteraction();
            await controller.playlistList(listInt);
            expectResponded(listInt);
        });
    });

    describe('TicketController (7 Commands)', () => {
        let controller;

        beforeAll(() => {
            controller = new TicketController(mockClient);
        });

        test('/ticket and /tickets', async () => {
            const ticketInt = createMockInteraction({
                stringOptions: { category: 'technical', description: 'Help needed' }
            });
            await controller.ticket(ticketInt);
            expectResponded(ticketInt);

            const ticketsInt = createMockInteraction();
            await controller.tickets(ticketsInt);
            expectResponded(ticketsInt);
        });

        test('/claim, /unclaim, and /close', async () => {
            const claimInt = createMockInteraction();
            await controller.claim(claimInt);
            expectResponded(claimInt);

            const unclaimInt = createMockInteraction();
            await controller.unclaim(unclaimInt);
            expectResponded(unclaimInt);

            const closeInt = createMockInteraction();
            await controller.close(closeInt);
            expectResponded(closeInt);
        });
    });

    describe('UtilityController (2 Commands)', () => {
        let controller;

        beforeAll(() => {
            controller = new UtilityController(mockClient);
        });

        test('/help', async () => {
            const helpInt = createMockInteraction();
            await controller.help(helpInt);
            expectResponded(helpInt);
        });

        test('/stats', async () => {
            const statsInt = createMockInteraction();
            await controller.stats(statsInt);
            expectResponded(statsInt);
        });
    });
});
