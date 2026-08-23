'use strict';

const { Collection } = require('discord.js');
const DatabaseLibrary = require('../bot/system/libraries/Database');
const MigrationManager = require('../bot/system/database/MigrationManager');
const EconomyModel = require('../bot/application/models/EconomyModel');
const LevelingModel = require('../bot/application/models/LevelingModel');
const GuildModel = require('../bot/application/models/GuildModel');
const GameService = require('../bot/application/modules/economy/services/GameService');
const EconomyService = require('../bot/application/modules/economy/services/EconomyService');
const ShopService = require('../bot/application/modules/economy/services/ShopService');
const LevelingService = require('../bot/application/modules/leveling/services/LevelingService');
const RewardService = require('../bot/application/modules/leveling/services/RewardService');
const GuildConfigService = require('../bot/application/modules/admin/services/GuildConfigService');
const PerformanceService = require('../bot/application/modules/admin/services/PerformanceService');
const AutomatedModerationService = require('../bot/system/services/AutomatedModerationService');

describe('Domain Services Suite', () => {
    let db;
    let mockClient;
    let economyModel;
    let levelingModel;
    let guildModel;

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
            ['guild-1', 'Service Guild', JSON.stringify({ welcome_enabled: true }), '!', now, now]
        );

        for (const u of ['u-1', 'u-2', 'u-3']) {
            await db.query(
                'INSERT INTO user_profiles (user_id, username, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO NOTHING',
                [u, `User_${u}`, now, now]
            );
        }

        economyModel = new EconomyModel({ db });
        levelingModel = new LevelingModel({ db });
        guildModel = new GuildModel({ db });

        const guildsCollection = new Collection();
        guildsCollection.set('guild-1', {
            id: 'guild-1',
            name: 'Service Guild',
            memberCount: 100,
            channels: { cache: new Collection([['c-1', { type: 0 }]]) },
            members: { cache: new Collection([['u-1', { user: { bot: false } }]]) },
            roles: { cache: new Collection() }
        });

        mockClient = {
            database: db,
            db: db,
            loader: {
                model: (name) => {
                    if (name === 'EconomyModel') return economyModel;
                    if (name === 'LevelingModel') return levelingModel;
                    if (name === 'GuildModel') return guildModel;
                    return null;
                }
            },
            logger: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
            },
            guilds: { cache: guildsCollection },
            users: { cache: new Collection() },
            channels: { cache: new Collection() },
            ws: { ping: 25 }
        };
    });

    describe('GameService (Blackjack Engine)', () => {
        let gameService;

        beforeAll(async () => {
            gameService = new GameService(mockClient);
            await gameService.initialize();
        });

        test('creates and shuffles card deck', () => {
            const deck = gameService.createDeck();
            expect(deck.length).toBe(52);

            const cards = deck.slice(0, 5);
            expect(cards[0]).toHaveProperty('suit');
            expect(cards[0]).toHaveProperty('rank');
        });

        test('calculates hand value with dynamic Aces', () => {
            // Ace + 9 = 20
            const hand1 = [
                { suit: '♠', rank: 'A' },
                { suit: '♥', rank: '9' }
            ];
            expect(gameService.calculateBlackjackValue(hand1)).toBe(20);

            // Ace + Ace + 9 = 21 (one Ace counts as 11, the other as 1)
            const hand2 = [
                { suit: '♠', rank: 'A' },
                { suit: '♦', rank: 'A' },
                { suit: '♥', rank: '9' }
            ];
            expect(gameService.calculateBlackjackValue(hand2)).toBe(21);

            // Face card + 10 = 20
            const hand3 = [
                { suit: '♠', rank: 'K' },
                { suit: '♥', rank: '10' }
            ];
            expect(gameService.calculateBlackjackValue(hand3)).toBe(20);
        });

        test('starts blackjack game and stores active state', () => {
            const game = gameService.createBlackjackGame('u-1', 'guild-1', 100);
            expect(game).toBeDefined();
            expect(game.bet).toBe(100);
            expect(game.playerHand.length).toBe(2);
            expect(game.dealerHand.length).toBe(2);

            const activeGame = gameService.getBlackjackGame('u-1', 'guild-1');
            expect(activeGame).toBeDefined();
            expect(activeGame.userId).toBe('u-1');
        });

        test('handles blackjack hit and stand actions', () => {
            const gameBefore = gameService.getBlackjackGame('u-1', 'guild-1');
            if (gameBefore && gameBefore.status === 'active') {
                const updated = gameService.blackjackHit('u-1', 'guild-1');
                expect(updated.playerHand.length).toBeGreaterThanOrEqual(3);

                if (updated.status === 'active') {
                    const standResult = gameService.blackjackStand('u-1', 'guild-1');
                    expect(['win', 'lose', 'tie', 'push']).toContain(standResult.result);
                }
            }
        });
    });

    describe('EconomyService', () => {
        let economyService;

        beforeAll(async () => {
            economyService = new EconomyService(mockClient);
            await economyService.initialize();
        });

        test('retrieves user balance', async () => {
            const balance = await economyService.getBalance('u-1', 'guild-1');
            expect(balance.wallet).toBeDefined();
            expect(balance.bank).toBeDefined();
            expect(balance.total).toBe(balance.wallet + balance.bank);
        });

        test('claims daily reward and handles cooldown', async () => {
            const daily = await economyService.claimDaily('u-1', 'guild-1');
            expect(daily.success).toBe(true);
            expect(daily.amount).toBeGreaterThan(0);

            // Second claim should be blocked by cooldown
            const secondDaily = await economyService.claimDaily('u-1', 'guild-1');
            expect(secondDaily.success).toBe(false);
            expect(secondDaily.timeLeft).toBeGreaterThan(0);
        });

        test('executes transfer and deposit/withdraw', async () => {
            const deposit = await economyService.deposit('u-1', 'guild-1', 100);
            expect(deposit.success).toBe(true);

            const withdraw = await economyService.withdraw('u-1', 'guild-1', 50);
            expect(withdraw.success).toBe(true);

            const transfer = await economyService.transfer('u-1', 'u-2', 'guild-1', 50);
            expect(transfer.success).toBe(true);
        });
    });

    describe('ShopService', () => {
        let shopService;
        let createdItemId;

        beforeAll(async () => {
            shopService = new ShopService(mockClient);
            await shopService.initialize();

            const item = await shopService.createItem('guild-1', 'VIP Role', 'Grants VIP status', 500, 10, 'role-vip');
            createdItemId = item.id;
        });

        test('retrieves shop items for guild', async () => {
            const items = await shopService.getItems('guild-1');
            expect(Array.isArray(items)).toBe(true);
            expect(items.length).toBeGreaterThanOrEqual(1);
            expect(items.some(i => i.name === 'VIP Role')).toBe(true);
        });

        test('buys item and logs to inventory', async () => {
            const buyResult = await shopService.purchaseItem('u-1', 'guild-1', createdItemId, 1);
            expect(buyResult.success).toBe(true);

            const inventory = await shopService.getInventory('u-1', 'guild-1');
            expect(Array.isArray(inventory)).toBe(true);
            expect(inventory.length).toBeGreaterThanOrEqual(1);
            expect(inventory.some(i => i.name === 'VIP Role')).toBe(true);
        });
    });

    describe('LevelingService & RewardService', () => {
        let levelingService;
        let rewardService;

        beforeAll(async () => {
            levelingService = new LevelingService(mockClient);
            await levelingService.initialize();

            rewardService = new RewardService(mockClient);
            await rewardService.initialize();
        });

        test('calculates required XP and levels properly', () => {
            expect(levelingService.calculateXPForLevel(1)).toBe(155);
            expect(levelingService.calculateXPForLevel(2)).toBe(220);
            expect(levelingService.calculateLevel(50)).toBe(0);
            expect(levelingService.calculateLevel(155)).toBe(1);
        });

        test('adds XP to user and detects level up', async () => {
            const result = await levelingService.addXP('u-1', 'guild-1', 200);
            expect(result.newXP).toBeGreaterThanOrEqual(200);
            expect(result.newLevel).toBeGreaterThanOrEqual(1);
        });

        test('retrieves user rank, stats, and leaderboard', async () => {
            const rank = await levelingService.getUserRank('u-1', 'guild-1');
            expect(typeof rank).toBe('number');
            expect(rank).toBeGreaterThanOrEqual(1);

            const userStats = await levelingService.getUserStats('u-1', 'guild-1');
            expect(userStats).toBeDefined();
            expect(userStats.xp).toBeGreaterThan(0);

            const leaderboard = await levelingService.getLeaderboard('guild-1', 'xp', 5);
            expect(leaderboard.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('AutomatedModerationService', () => {
        let autoMod;

        beforeAll(() => {
            autoMod = new AutomatedModerationService(mockClient);
        });

        test('detects Discord invite links', () => {
            const mockMsgWithInvite = {
                content: 'Join my cool server: https://discord.gg/abc123xyz'
            };
            const res = autoMod.check_invites(mockMsgWithInvite, { anti_invite: true });
            expect(res.violated).toBe(true);
            expect(res.type).toBe('invite');

            const cleanMsg = { content: 'Hello everybody!' };
            expect(autoMod.check_invites(cleanMsg, { anti_invite: true }).violated).toBe(false);
        });

        test('detects general links when anti_link is enabled', () => {
            const mockMsgWithLink = {
                content: 'Check out this website: https://example.com/malicious'
            };
            const res = autoMod.check_links(mockMsgWithLink, { anti_link: true, allowed_domains: [] });
            expect(res.violated).toBe(true);
            expect(res.type).toBe('link');
        });

        test('detects excessive CAPS spam', () => {
            const shoutMsg = {
                content: 'PLEASE HELP ME RIGHT NOW THIS IS ALL IN CAPITAL LETTERS'
            };
            const res = autoMod.check_caps(shoutMsg, { anti_caps: true, caps_percentage: 70, min_length: 10 });
            expect(res.violated).toBe(true);
            expect(res.type).toBe('caps');
        });

        test('detects excessive mention spam', () => {
            const mentionMsg = {
                content: '<@111> <@222> <@333> <@444> <@555> <@666> hello',
                mentions: {
                    users: new Collection([[1, {}], [2, {}], [3, {}], [4, {}], [5, {}], [6, {}]]),
                    roles: new Collection()
                }
            };
            const res = autoMod.check_mention_spam(mentionMsg, { anti_mention_spam: true, mention_spam_threshold: 4 });
            expect(res.violated).toBe(true);
            expect(res.type).toBe('mention_spam');
        });
    });

    describe('GuildConfigService & PerformanceService', () => {
        let configService;
        let perfService;

        beforeAll(async () => {
            configService = new GuildConfigService(mockClient);
            await configService.initialize();

            perfService = new PerformanceService(mockClient);
            await perfService.initialize();
        });

        test('retrieves and updates guild configuration', async () => {
            const config = await configService.getGuildConfig('guild-1');
            expect(config).toBeDefined();

            await configService.setSetting('guild-1', 'volume_default', 90);
            const val = await configService.getSetting('guild-1', 'volume_default');
            expect(val).toBe(90);
        });

        test('gathers system and bot performance metrics', async () => {
            const systemMetrics = perfService.getSystemMetrics();
            expect(systemMetrics).toBeDefined();
            expect(systemMetrics.memory).toBeDefined();
            expect(systemMetrics.cpu).toBeDefined();

            const botMetrics = perfService.getBotMetrics();
            expect(botMetrics).toBeDefined();
            expect(botMetrics.guilds).toBeDefined();
        });
    });
});
