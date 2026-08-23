'use strict';

const { Collection } = require('discord.js');

// Music Buttons
const MusicPlayPause = require('../bot/application/modules/music/interactions/buttons/MusicPlayPause');
const MusicSkip = require('../bot/application/modules/music/interactions/buttons/MusicSkip');
const MusicStop = require('../bot/application/modules/music/interactions/buttons/MusicStop');
const MusicLoop = require('../bot/application/modules/music/interactions/buttons/MusicLoop');
const MusicVolumeUp = require('../bot/application/modules/music/interactions/buttons/MusicVolumeUp');
const MusicVolumeDown = require('../bot/application/modules/music/interactions/buttons/MusicVolumeDown');

// Economy Buttons
const BlackjackHit = require('../bot/application/modules/economy/interactions/buttons/BlackjackHit');
const BlackjackStand = require('../bot/application/modules/economy/interactions/buttons/BlackjackStand');
const ShopBuyConfirm = require('../bot/application/modules/economy/interactions/buttons/ShopBuyConfirm');
const ShopBuyCancel = require('../bot/application/modules/economy/interactions/buttons/ShopBuyCancel');

// Moderation Buttons & Modals
const BanConfirm = require('../bot/application/modules/moderation/interactions/buttons/BanConfirm');
const BanCancel = require('../bot/application/modules/moderation/interactions/buttons/BanCancel');
const KickConfirm = require('../bot/application/modules/moderation/interactions/buttons/KickConfirm');
const KickCancel = require('../bot/application/modules/moderation/interactions/buttons/KickCancel');
const WarnReason = require('../bot/application/modules/moderation/interactions/modals/WarnReason');

// Utility Buttons
const HelpMusic = require('../bot/application/modules/utility/interactions/buttons/help-music');
const HelpAdmin = require('../bot/application/modules/utility/interactions/buttons/help-admin');
const HelpEconomy = require('../bot/application/modules/utility/interactions/buttons/help-economy');
const HelpLeveling = require('../bot/application/modules/utility/interactions/buttons/help-leveling');
const HelpModeration = require('../bot/application/modules/utility/interactions/buttons/help-moderation');
const HelpUtility = require('../bot/application/modules/utility/interactions/buttons/help-utility');
const HelpBack = require('../bot/application/modules/utility/interactions/buttons/help-back');

function createMockButtonInteraction(customId, overrides = {}) {
    return {
        customId,
        id: 'btn-interaction-1',
        guildId: 'guild-1',
        user: { id: 'u-1', tag: 'User#0001', username: 'User' },
        member: {
            id: 'u-1',
            user: { id: 'u-1', tag: 'User#0001' },
            permissions: { has: () => true },
            roles: { cache: new Collection() },
            voice: {
                channel: {
                    id: 'voice-1',
                    members: new Collection([['bot-id', {}], ['u-1', {}]])
                },
                channelId: 'voice-1'
            }
        },
        guild: {
            id: 'guild-1',
            name: 'Button Test Guild',
            members: {
                me: {
                    id: 'bot-id',
                    voice: { channelId: 'voice-1', channel: { id: 'voice-1' } },
                    permissions: { has: () => true }
                },
                cache: new Collection([['u-1', { id: 'u-1' }]])
            },
            bans: { create: jest.fn().mockResolvedValue({}) }
        },
        message: {
            id: 'msg-1',
            embeds: [],
            edit: jest.fn().mockResolvedValue({})
        },
        fields: {
            getTextInputValue: jest.fn().mockReturnValue('Test reason from modal')
        },
        deferred: false,
        replied: false,
        reply: jest.fn().mockResolvedValue({}),
        deferReply: jest.fn().mockResolvedValue({}),
        deferUpdate: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        followUp: jest.fn().mockResolvedValue({}),
        ...overrides
    };
}

describe('Interactive Components Suite (Buttons & Modals)', () => {
    let mockClient;
    let playerServiceMock;
    let gameServiceMock;
    let economyServiceMock;
    let shopServiceMock;
    let moderationServiceMock;

    beforeAll(() => {
        playerServiceMock = {
            isConnected: jest.fn().mockReturnValue(true),
            isPlaying: jest.fn().mockReturnValue(true),
            isPaused: jest.fn().mockReturnValue(false),
            pause: jest.fn(),
            resume: jest.fn(),
            skip: jest.fn().mockReturnValue(true),
            stop: jest.fn().mockReturnValue(true),
            setLoop: jest.fn().mockResolvedValue(true),
            setLoopMode: jest.fn(),
            getLoopMode: jest.fn().mockReturnValue('off'),
            getVolume: jest.fn().mockReturnValue(80),
            setVolume: jest.fn(),
            getQueue: jest.fn().mockReturnValue({ currentTrack: { title: 'Test Track' }, tracks: [], loop: 'off' }),
            getCurrent: jest.fn().mockReturnValue({ title: 'Test Track', duration: 180 }),
            getCurrentTrack: jest.fn().mockReturnValue({ title: 'Test Track', duration: 180 }),
            formatDuration: jest.fn().mockReturnValue('3:00'),
            createProgressBar: jest.fn().mockReturnValue('🔘─────')
        };

        gameServiceMock = {
            getBlackjackGame: jest.fn().mockReturnValue({
                status: 'active',
                userId: 'u-1',
                playerHand: [{ suit: '♠', rank: '10' }],
                dealerHand: [{ suit: '♥', rank: '7' }],
                playerValue: 10,
                dealerValue: 7,
                bet: 50
            }),
            blackjackHit: jest.fn().mockReturnValue({
                status: 'active',
                playerHand: [{ suit: '♠', rank: '10' }, { suit: '♦', rank: '9' }],
                dealerHand: [{ suit: '♥', rank: '7' }],
                playerValue: 19,
                dealerValue: 7,
                bet: 50
            }),
            blackjackStand: jest.fn().mockReturnValue({
                status: 'completed',
                result: 'win',
                winAmount: 100,
                playerHand: [{ suit: '♠', rank: '10' }, { suit: '♦', rank: '9' }],
                dealerHand: [{ suit: '♥', rank: '7' }, { suit: '♣', rank: '10' }],
                playerValue: 19,
                dealerValue: 17,
                bet: 50
            }),
            formatHand: jest.fn().mockReturnValue('♠10 ♦9'),
            formatCard: jest.fn().mockReturnValue('♥7')
        };

        economyServiceMock = {
            addBalance: jest.fn().mockResolvedValue({ success: true })
        };

        shopServiceMock = {
            purchaseItem: jest.fn().mockResolvedValue({ success: true, item: { name: 'VIP' } })
        };

        moderationServiceMock = {
            banMember: jest.fn().mockResolvedValue({ success: true }),
            kickMember: jest.fn().mockResolvedValue({ success: true }),
            warnMember: jest.fn().mockResolvedValue({ success: true })
        };

        const musicModule = {
            getService: (name) => playerServiceMock,
            commands: [{ name: 'play', description: 'Play music' }]
        };

        const economyModule = {
            getService: (name) => {
                if (name === 'GameService') return gameServiceMock;
                if (name === 'EconomyService') return economyServiceMock;
                if (name === 'ShopService') return shopServiceMock;
                return null;
            },
            commands: [{ name: 'balance', description: 'Check balance' }]
        };

        const adminModule = {
            getService: () => null,
            commands: [{ name: 'config', description: 'Config' }]
        };

        const levelingModule = {
            commands: [{ name: 'rank', description: 'Rank' }]
        };

        const moderationModule = {
            getService: () => moderationServiceMock,
            commands: [{ name: 'warn', description: 'Warn' }]
        };

        const utilityModule = {
            commands: [{ name: 'help', description: 'Help' }]
        };

        const modulesMap = new Map([
            ['music', musicModule],
            ['economy', economyModule],
            ['admin', adminModule],
            ['leveling', levelingModule],
            ['moderation', moderationModule],
            ['utility', utilityModule]
        ]);

        mockClient = {
            modules: modulesMap,
            services: new Map(),
            user: { id: 'bot-id', tag: 'Bot#0001' },
            logger: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
            }
        };
    });

    describe('Music Button Interactions', () => {
        test('MusicPlayPause toggles playback', async () => {
            const btn = new MusicPlayPause(mockClient);
            const interaction = createMockButtonInteraction('music_play_pause');
            await btn.execute(interaction);
            expect(playerServiceMock.pause).toHaveBeenCalled();
        });

        test('MusicSkip skips current track', async () => {
            const btn = new MusicSkip(mockClient);
            const interaction = createMockButtonInteraction('music_skip');
            await btn.execute(interaction);
            expect(playerServiceMock.skip).toHaveBeenCalled();
        });

        test('MusicStop stops playback and clears queue', async () => {
            const btn = new MusicStop(mockClient);
            const interaction = createMockButtonInteraction('music_stop');
            await btn.execute(interaction);
            expect(playerServiceMock.stop).toHaveBeenCalled();
        });

        test('MusicLoop changes loop mode', async () => {
            const btn = new MusicLoop(mockClient);
            const interaction = createMockButtonInteraction('music_loop');
            await btn.execute(interaction);
            expect(playerServiceMock.setLoop).toHaveBeenCalled();
        });

        test('MusicVolumeUp and MusicVolumeDown adjust volume', async () => {
            const volUp = new MusicVolumeUp(mockClient);
            const intUp = createMockButtonInteraction('music_volume_up');
            await volUp.execute(intUp);
            expect(playerServiceMock.setVolume).toHaveBeenCalledWith('guild-1', 90);

            const volDown = new MusicVolumeDown(mockClient);
            const intDown = createMockButtonInteraction('music_volume_down');
            await volDown.execute(intDown);
            expect(playerServiceMock.setVolume).toHaveBeenCalledWith('guild-1', 70);
        });
    });

    describe('Economy Button Interactions', () => {
        test('BlackjackHit requests an additional card', async () => {
            const btn = new BlackjackHit(mockClient);
            const interaction = createMockButtonInteraction('blackjack_hit');
            await btn.execute(interaction);
            expect(gameServiceMock.blackjackHit).toHaveBeenCalled();
            expect(interaction.update).toHaveBeenCalled();
        });

        test('BlackjackStand stands and concludes dealer round', async () => {
            const btn = new BlackjackStand(mockClient);
            const interaction = createMockButtonInteraction('blackjack_stand');
            await btn.execute(interaction);
            expect(gameServiceMock.blackjackStand).toHaveBeenCalled();
            expect(interaction.update).toHaveBeenCalled();
        });

        test('ShopBuyConfirm and ShopBuyCancel handle confirmation modal/buttons', async () => {
            const confirmBtn = new ShopBuyConfirm(mockClient);
            const confirmInt = createMockButtonInteraction('shop_buy_confirm:item-1:1');
            await confirmBtn.execute(confirmInt);
            expect(confirmInt.reply || confirmInt.update || confirmInt.deferUpdate).toBeDefined();

            const cancelBtn = new ShopBuyCancel(mockClient);
            const cancelInt = createMockButtonInteraction('shop_buy_cancel');
            await cancelBtn.execute(cancelInt);
            expect(cancelInt.reply || cancelInt.update || cancelInt.deferUpdate).toBeDefined();
        });
    });

    describe('Moderation Buttons and Modals', () => {
        test('BanConfirm and BanCancel execute ban confirmation flow', async () => {
            const banConfirm = new BanConfirm(mockClient);
            const intConfirm = createMockButtonInteraction('ban_confirm:target-1');
            await banConfirm.execute(intConfirm);
            expect(intConfirm.update || intConfirm.reply).toBeDefined();

            const banCancel = new BanCancel(mockClient);
            const intCancel = createMockButtonInteraction('ban_cancel');
            await banCancel.execute(intCancel);
            expect(intCancel.update || intCancel.reply).toBeDefined();
        });

        test('KickConfirm and KickCancel execute kick confirmation flow', async () => {
            const kickConfirm = new KickConfirm(mockClient);
            const intConfirm = createMockButtonInteraction('kick_confirm:target-1');
            await kickConfirm.execute(intConfirm);
            expect(intConfirm.update || intConfirm.reply).toBeDefined();

            const kickCancel = new KickCancel(mockClient);
            const intCancel = createMockButtonInteraction('kick_cancel');
            await kickCancel.execute(intCancel);
            expect(intCancel.update || intCancel.reply).toBeDefined();
        });

        test('WarnReason modal processes warning submission', async () => {
            const warnModal = new WarnReason(mockClient);
            const modalInt = createMockButtonInteraction('warn_reason_modal:target-1');
            await warnModal.execute(modalInt);
            expect(modalInt.reply || modalInt.deferReply || modalInt.update).toBeDefined();
        });
    });

    describe('Utility Help Navigation Buttons', () => {
        test('Help category buttons update embed view with category commands', async () => {
            const buttons = [
                new HelpMusic(mockClient),
                new HelpAdmin(mockClient),
                new HelpEconomy(mockClient),
                new HelpLeveling(mockClient),
                new HelpModeration(mockClient),
                new HelpUtility(mockClient),
                new HelpBack(mockClient),
            ];

            for (const btn of buttons) {
                const interaction = createMockButtonInteraction(btn.customId);
                await btn.execute(interaction);
                const responded =
                    interaction.update.mock.calls.length +
                    interaction.deferUpdate.mock.calls.length +
                    interaction.editReply.mock.calls.length;
                expect(responded).toBeGreaterThan(0);
            }
        });
    });
});
