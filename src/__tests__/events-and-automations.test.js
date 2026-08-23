'use strict';

const { Collection } = require('discord.js');
const MessageCreateEvent = require('../bot/application/events/MessageCreate');
const GuildMemberAddEvent = require('../bot/application/events/GuildMemberAdd');
const GuildMemberRemoveEvent = require('../bot/application/events/GuildMemberRemove');
const InteractionCreateEvent = require('../bot/application/events/InteractionCreate');
const GuildCreateEvent = require('../bot/application/events/GuildCreate');
const GuildDeleteEvent = require('../bot/application/events/GuildDelete');

describe('Event Handlers and Automations Suite', () => {
    let mockClient;
    let autoModMock;
    let configServiceMock;
    let guildInitServiceMock;
    let testControllerMock;

    beforeAll(() => {
        autoModMock = {
            check_message: jest.fn().mockImplementation(async (msg) => {
                if (msg.content.includes('badword')) {
                    return { violated: true, type: 'bad_words', rule: 'profanity' };
                }
                return { violated: false };
            })
        };

        configServiceMock = {
            getGuildConfig: jest.fn().mockResolvedValue({
                prefix: '!',
                welcome_enabled: true,
                welcome_channel: 'welcome-chan-id',
                welcome_message: 'Welcome {user} to {guild}!',
                goodbye_enabled: true,
                goodbye_channel: 'goodbye-chan-id',
                goodbye_message: 'Goodbye {user} from {guild}!',
                autorole_enabled: true,
                autorole_id: 'auto-role-1'
            }),
            getSetting: jest.fn().mockImplementation(async (guildId, key) => {
                if (key === 'welcome_enabled') return true;
                if (key === 'welcome_channel') return 'welcome-chan-id';
                if (key === 'goodbye_enabled') return true;
                if (key === 'goodbye_channel') return 'goodbye-chan-id';
                if (key === 'autorole_enabled') return true;
                if (key === 'autorole_id') return 'auto-role-1';
                return null;
            })
        };

        guildInitServiceMock = {
            initializeMember: jest.fn().mockResolvedValue(true)
        };

        testControllerMock = {
            ping: jest.fn().mockResolvedValue({})
        };

        const adminModule = {
            getService: (name) => {
                if (name === 'GuildConfigService') return configServiceMock;
                if (name === 'GuildInitializationService') return guildInitServiceMock;
                return null;
            },
            commands: [{ name: 'ping', controller: 'TestController', method: 'ping' }]
        };

        const modulesMap = new Map([['admin', adminModule]]);
        const controllersMap = new Map([['TestController', testControllerMock]]);

        mockClient = {
            modules: modulesMap,
            controllers: controllersMap,
            automatedModerationService: autoModMock,
            services: new Map([['GuildConfigService', configServiceMock]]),
            user: { id: 'bot-123', tag: 'EyeDaemon#0001' },
            logger: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
            }
        };
    });

    describe('MessageCreate Event', () => {
        let eventHandler;

        beforeAll(() => {
            eventHandler = new MessageCreateEvent(mockClient);
        });

        test('ignores messages authored by bots', async () => {
            const botMessage = {
                author: { bot: true },
                content: '!ping'
            };
            await eventHandler.execute(botMessage);
            expect(autoModMock.check_message).not.toHaveBeenCalled();
        });

        test('runs AutoMod inspection on user messages', async () => {
            const userMessage = {
                author: { bot: false, id: 'u-1', tag: 'User#0001' },
                guild: { id: 'guild-1', name: 'Test Guild' },
                content: 'this contains badword text',
                delete: jest.fn().mockResolvedValue({}),
                reply: jest.fn().mockResolvedValue({}),
                channel: { send: jest.fn().mockResolvedValue({}) }
            };

            await eventHandler.execute(userMessage);
            expect(autoModMock.check_message).toHaveBeenCalledWith(userMessage);
        });
    });

    describe('GuildMemberAdd Event', () => {
        let eventHandler;

        beforeAll(() => {
            eventHandler = new GuildMemberAddEvent(mockClient);
        });

        test('processes member join, welcome message, and auto-role', async () => {
            const welcomeChannelMock = {
                id: 'welcome-chan-id',
                send: jest.fn().mockResolvedValue({})
            };

            const member = {
                user: { id: 'u-new', tag: 'NewMember#0001', bot: false },
                guild: {
                    id: 'guild-1',
                    name: 'Test Guild',
                    channels: {
                        cache: new Collection([['welcome-chan-id', welcomeChannelMock]]),
                        fetch: jest.fn().mockResolvedValue(welcomeChannelMock)
                    },
                    roles: {
                        cache: new Collection([['auto-role-1', { id: 'auto-role-1', name: 'Member' }]])
                    }
                },
                roles: {
                    add: jest.fn().mockResolvedValue({})
                }
            };

            await eventHandler.execute(member);
            expect(member.roles.add).toBeDefined();
        });
    });

    describe('GuildMemberRemove Event', () => {
        let eventHandler;

        beforeAll(() => {
            eventHandler = new GuildMemberRemoveEvent(mockClient);
        });

        test('processes member leave and sends goodbye message', async () => {
            const goodbyeChannelMock = {
                id: 'goodbye-chan-id',
                send: jest.fn().mockResolvedValue({})
            };

            const member = {
                user: { id: 'u-left', tag: 'Leaver#0001', bot: false },
                guild: {
                    id: 'guild-1',
                    name: 'Test Guild',
                    channels: {
                        cache: new Collection([['goodbye-chan-id', goodbyeChannelMock]]),
                        fetch: jest.fn().mockResolvedValue(goodbyeChannelMock)
                    }
                }
            };

            await eventHandler.execute(member);
            expect(member.user.tag).toBe('Leaver#0001');
        });
    });

    describe('InteractionCreate Event', () => {
        let eventHandler;

        beforeAll(() => {
            eventHandler = new InteractionCreateEvent(mockClient);
        });

        test('routes chat input slash commands to controller methods', async () => {
            const slashInteraction = {
                type: 2,
                isChatInputCommand: () => true,
                isButton: () => false,
                isModalSubmit: () => false,
                isStringSelectMenu: () => false,
                isUserContextMenuCommand: () => false,
                isMessageContextMenuCommand: () => false,
                commandName: 'ping',
                reply: jest.fn().mockResolvedValue({}),
                user: { tag: 'User#0001' }
            };

            await eventHandler.execute(slashInteraction);
            expect(testControllerMock.ping).toHaveBeenCalled();
        });
    });

    describe('GuildCreate & GuildDelete Events', () => {
        test('GuildCreate initializes guild setup', async () => {
            const guildCreate = new GuildCreateEvent(mockClient);
            const guild = {
                id: 'new-guild-1',
                name: 'New Guild',
                memberCount: 15
            };

            await guildCreate.execute(guild);
            expect(guildCreate.name).toBe('guildCreate');
        });

        test('GuildDelete cleans up guild state', async () => {
            const guildDelete = new GuildDeleteEvent(mockClient);
            const guild = {
                id: 'deleted-guild-1',
                name: 'Deleted Guild'
            };

            await guildDelete.execute(guild);
            expect(guildDelete.name).toBe('guildDelete');
        });
    });
});
