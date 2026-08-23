'use strict';

const { Collection } = require('discord.js');
const DatabaseLibrary = require('../bot/system/libraries/Database');
const MigrationManager = require('../bot/system/database/MigrationManager');
const GuildModel = require('../bot/application/models/GuildModel');
const EconomyModel = require('../bot/application/models/EconomyModel');
const LevelingModel = require('../bot/application/models/LevelingModel');
const ModerationModel = require('../bot/application/models/ModerationModel');
const MusicModel = require('../bot/application/models/MusicModel');
const TicketModel = require('../bot/application/models/TicketModel');
const UtilityModel = require('../bot/application/models/UtilityModel');
const PlaylistService = require('../bot/application/modules/music/services/PlaylistService');

describe('Database and Data Models Integration', () => {
    let db;
    let mockClient;
    let migrationManager;

    beforeAll(async () => {
        // Create in-memory LibSQL database instance with shared cache
        db = new DatabaseLibrary(null, {
            url: 'file::memory:?cache=shared',
            enablePerformanceLogging: false,
            enableMetricsTracking: false,
        });

        await db.connect();

        // Run migrations first
        migrationManager = new MigrationManager(db);
        await migrationManager.runMigrations();

        // Populate base seed data for foreign keys
        const now = Math.floor(Date.now() / 1000);
        await db.query(
            'INSERT INTO guilds (guild_id, name, config_json, prefix, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            ['guild-123', 'Test Guild', JSON.stringify({ welcome_enabled: true }), '!', now, now]
        );

        const users = ['user-456', 'user-789', 'mod-999', 'staff-777'];
        for (const u of users) {
            await db.query(
                'INSERT INTO user_profiles (user_id, username, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO NOTHING',
                [u, `User_${u}`, now, now]
            );
        }

        const membersCollection = new Collection();
        membersCollection.set('user-456', { user: { bot: false } });
        membersCollection.set('bot-1', { user: { bot: true } });

        const channelsCollection = new Collection();
        channelsCollection.set('chan-1', { type: 0 });
        channelsCollection.set('chan-2', { type: 2 });

        const rolesCollection = new Collection();
        rolesCollection.set('role-1', { id: 'role-1' });

        const guildsCollection = new Collection();
        guildsCollection.set('guild-123', {
            id: 'guild-123',
            name: 'Test Guild',
            memberCount: 50,
            members: { cache: membersCollection },
            channels: { cache: channelsCollection },
            roles: { cache: rolesCollection }
        });

        const clientUsersCollection = new Collection();
        clientUsersCollection.set('user-456', { id: 'user-456', tag: 'TestUser#0001' });

        const clientChannelsCollection = new Collection();
        clientChannelsCollection.set('channel-789', { id: 'channel-789', name: 'general' });

        mockClient = {
            database: db,
            db: db,
            logger: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
            },
            guilds: { cache: guildsCollection },
            users: { cache: clientUsersCollection },
            channels: { cache: clientChannelsCollection },
            ws: { ping: 42 }
        };
    });

    describe('MigrationManager', () => {
        test('creates all expected tables', async () => {
            const tables = await db.query(`
                SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';
            `);
            const tableNames = tables.map(t => t.name);

            expect(tableNames).toContain('guilds');
            expect(tableNames).toContain('economy_accounts');
            expect(tableNames).toContain('user_levels');
            expect(tableNames).toContain('user_warnings');
            expect(tableNames).toContain('playlists');
            expect(tableNames).toContain('tickets');
        });
    });

    describe('GuildModel', () => {
        let guildModel;

        beforeAll(() => {
            guildModel = new GuildModel({ client: mockClient, db: db });
        });

        test('retrieves guild configuration', async () => {
            const config = await guildModel.getGuildConfig('guild-123');
            expect(config).toBeDefined();
            expect(config.guild_id).toBe('guild-123');
            expect(config.config.welcome_enabled).toBe(true);
        });

        test('updates guild configuration', async () => {
            await guildModel.updateGuildConfig('guild-123', {
                welcome_enabled: false,
                economy_enabled: true
            });

            const updated = await guildModel.getGuildConfig('guild-123');
            expect(updated.config.welcome_enabled).toBe(false);
            expect(updated.config.economy_enabled).toBe(true);
        });
    });

    describe('EconomyModel', () => {
        let economyModel;

        beforeAll(() => {
            economyModel = new EconomyModel({ client: mockClient, db: db });
        });

        test('gets default balance for new user', async () => {
            const balance = await economyModel.getUserBalance('user-456', 'guild-123');
            expect(balance.balance).toBe(1000);
            expect(balance.bank_balance).toBe(0);
            expect(balance.total).toBe(1000);
        });

        test('updates balance atomically', async () => {
            await economyModel.updateBalance('user-456', 'guild-123', 500, 'balance', 'work', 'Daily shift');
            const balance = await economyModel.getUserBalance('user-456', 'guild-123');
            expect(balance.balance).toBe(1500);

            await economyModel.updateBalance('user-456', 'guild-123', 300, 'bank_balance', 'deposit', 'Bank deposit');
            const newBalance = await economyModel.getUserBalance('user-456', 'guild-123');
            expect(newBalance.bank_balance).toBe(300);
            expect(newBalance.total).toBe(1800);
        });

        test('handles work and transfers between users', async () => {
            const transferResult = await economyModel.transfer('user-456', 'user-789', 'guild-123', 200);
            expect(transferResult.success).toBe(true);

            const receiverBal = await economyModel.getUserBalance('user-789', 'guild-123');
            expect(receiverBal.balance).toBe(1200);
        });
    });

    describe('LevelingModel', () => {
        let levelingModel;

        beforeAll(() => {
            levelingModel = new LevelingModel({ client: mockClient, db: db });
        });

        test('calculates XP and retrieves initial level info', async () => {
            const levelInfo = await levelingModel.getUserLevel('user-456', 'guild-123');
            expect(levelInfo.level).toBe(0);
            expect(levelInfo.xp).toBe(0);
        });

        test('adds XP and updates user level', async () => {
            const updateResult = await levelingModel.addXP('user-456', 'guild-123', 250);
            expect(updateResult.newXP).toBe(250);

            const levelInfo = await levelingModel.getUserLevel('user-456', 'guild-123');
            expect(levelInfo.xp).toBe(250);
        });

        test('retrieves server leaderboard', async () => {
            const leaderboard = await levelingModel.getLeaderboard('guild-123', 'xp', 10);
            expect(Array.isArray(leaderboard)).toBe(true);
            expect(leaderboard.length).toBeGreaterThanOrEqual(1);
            expect(leaderboard[0].userId).toBe('user-456');
        });
    });

    describe('ModerationModel', () => {
        let moderationModel;
        let warningId;

        beforeAll(() => {
            moderationModel = new ModerationModel({ client: mockClient, db: db });
        });

        test('logs moderation warning and queries history', async () => {
            const warning = await moderationModel.addWarning(
                'user-456',
                'guild-123',
                'mod-999',
                'Spamming in chat'
            );

            expect(warning).toBeDefined();
            expect(warning.reason).toBe('Spamming in chat');
            warningId = warning.id;

            const warnings = await moderationModel.getWarnings('user-456', 'guild-123');
            expect(Array.isArray(warnings)).toBe(true);
            expect(warnings.length).toBeGreaterThanOrEqual(1);
            expect(warnings[0].reason).toBe('Spamming in chat');
        });

        test('removes active warning', async () => {
            await moderationModel.removeWarning(warningId);
            const activeWarnings = await moderationModel.getWarnings('user-456', 'guild-123', true);
            expect(activeWarnings.length).toBe(0);
        });
    });

    describe('MusicModel & PlaylistService', () => {
        let musicModel;
        let playlistService;
        let playlistId;

        beforeAll(() => {
            musicModel = new MusicModel({ client: mockClient, db: db });
            playlistService = new PlaylistService(mockClient);
        });

        test('MusicModel retrieves metadata interface and cache controls', () => {
            expect(typeof musicModel.getTrackInfo).toBe('function');
            expect(typeof musicModel.clearCache).toBe('function');
            expect(typeof musicModel.invalidate).toBe('function');
        });

        test('PlaylistService creates, retrieves, and deletes playlist', async () => {
            const playlist = await playlistService.createPlaylist({
                userId: 'user-456',
                guildId: 'guild-123',
                name: 'My Best Tracks',
                isPublic: true,
                description: 'Favorite songs'
            });

            expect(playlist).toBeDefined();
            expect(playlist.name).toBe('My Best Tracks');
            playlistId = playlist.id;

            await playlistService.addTrack(
                playlistId,
                'user-456',
                {
                    title: 'Test Song',
                    url: 'https://youtube.com/watch?v=sample123',
                    duration: 210,
                    requestedBy: 'user-456'
                }
            );

            const fetched = await playlistService.getPlaylist(playlistId);
            expect(fetched).toBeDefined();
            expect(fetched.name).toBe('My Best Tracks');
            expect(fetched.trackCount).toBe(1);

            const deleted = await playlistService.deletePlaylist(playlistId, 'user-456');
            expect(deleted).toBe(true);
        });
    });

    describe('TicketModel', () => {
        let ticketModel;
        let ticketId;

        beforeAll(() => {
            ticketModel = new TicketModel({ client: mockClient, db: db });
        });

        test('creates and retrieves a support ticket', async () => {
            const ticket = await ticketModel.createTicket(
                'guild-123',
                'user-456',
                'ticket-chan-1',
                'technical',
                'Cannot play music'
            );

            expect(ticket).toBeDefined();
            expect(ticket.status).toBe('open');
            ticketId = ticket.id;

            const fetched = await ticketModel.getTicketByChannel('ticket-chan-1', 'guild-123');
            expect(fetched).toBeDefined();
            expect(fetched.category).toBe('technical');
            expect(fetched.status).toBe('open');
        });

        test('claims and closes a ticket', async () => {
            await ticketModel.claimTicket(ticketId, 'staff-777');
            let updated = await ticketModel.getTicketByChannel('ticket-chan-1', 'guild-123');
            expect(updated.claimed_by).toBe('staff-777');

            await ticketModel.closeTicket(ticketId, 'user-456', 'Resolved');
            updated = await ticketModel.getTicketByChannel('ticket-chan-1', 'guild-123');
            expect(updated.status).toBe('closed');
        });
    });

    describe('UtilityModel', () => {
        let utilityModel;

        beforeAll(() => {
            utilityModel = new UtilityModel({ client: mockClient, db: db });
        });

        test('retrieves bot statistics and guild information', async () => {
            const stats = await utilityModel.getBotStats(mockClient);
            expect(stats).toBeDefined();
            expect(stats.guilds).toBe(1);
            expect(stats.users).toBe(1);
            expect(stats.channels).toBe(1);

            const guildObj = mockClient.guilds.cache.get('guild-123');
            const guildStats = await utilityModel.getGuildStats(guildObj);
            expect(guildStats.totalMembers).toBe(50);
            expect(guildStats.totalChannels).toBe(2);
            expect(guildStats.totalRoles).toBe(1);
        });
    });
});
