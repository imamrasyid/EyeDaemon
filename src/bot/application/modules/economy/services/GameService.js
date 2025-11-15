/**
 * GameService
 * 
 * Business logic for economy games including blackjack, roulette, slots, and coinflip.
 * Manages game state and cleanup of expired games.
 */

const BaseService = require('../../../../system/core/BaseService');

class GameService extends BaseService {
    /**
     * Create a new GameService instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Service configuration options
     */
    constructor(client, options = {}) {
        super(client, options);

        // Store active games in memory
        this.activeGames = new Map();

        // Game expiration time (5 minutes)
        this.gameExpirationMs = 5 * 60 * 1000;

        // Note: Cleanup is handled by CleanupManager
    }

    /**
     * Initialize service
     * @returns {Promise<void>}
     */
    async initialize() {
        await super.initialize();

        this.log('GameService initialized', 'info');
    }

    /**
     * Shutdown service
     * @returns {Promise<void>}
     */
    async shutdown() {
        this.activeGames.clear();

        await super.shutdown();
    }

    /**
     * Create a new blackjack game
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} bet - Bet amount
     * @returns {Object} Game state
     */
    createBlackjackGame(userId, guildId, bet) {
        const gameId = `${guildId}-${userId}-blackjack`;

        // Create deck and shuffle
        const deck = this.createDeck();
        this.shuffleDeck(deck);

        // Deal initial cards
        const playerHand = [deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop()];

        const game = {
            type: 'blackjack',
            userId,
            guildId,
            bet,
            deck,
            playerHand,
            dealerHand,
            playerValue: this.calculateBlackjackValue(playerHand),
            dealerValue: this.calculateBlackjackValue(dealerHand),
            status: 'active',
            createdAt: Date.now()
        };

        this.activeGames.set(gameId, game);

        this.log(`Created blackjack game for user ${userId}`, 'debug', { bet });

        return game;
    }

    /**
     * Hit in blackjack (draw a card)
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Object} Updated game state
     */
    blackjackHit(userId, guildId) {
        const gameId = `${guildId}-${userId}-blackjack`;
        const game = this.activeGames.get(gameId);

        if (!game) {
            throw new Error('No active blackjack game found');
        }

        if (game.status !== 'active') {
            throw new Error('Game is not active');
        }

        // Draw card
        const card = game.deck.pop();
        game.playerHand.push(card);
        game.playerValue = this.calculateBlackjackValue(game.playerHand);

        // Check if bust
        if (game.playerValue > 21) {
            game.status = 'bust';
            game.result = 'lose';
            this.activeGames.delete(gameId);
        }

        return game;
    }

    /**
     * Stand in blackjack (end turn)
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Object} Final game state with result
     */
    blackjackStand(userId, guildId) {
        const gameId = `${guildId}-${userId}-blackjack`;
        const game = this.activeGames.get(gameId);

        if (!game) {
            throw new Error('No active blackjack game found');
        }

        if (game.status !== 'active') {
            throw new Error('Game is not active');
        }

        // Dealer draws until 17 or higher
        while (game.dealerValue < 17) {
            const card = game.deck.pop();
            game.dealerHand.push(card);
            game.dealerValue = this.calculateBlackjackValue(game.dealerHand);
        }

        // Determine winner
        if (game.dealerValue > 21) {
            game.result = 'win';
            game.winAmount = game.bet * 2;
        } else if (game.playerValue > game.dealerValue) {
            game.result = 'win';
            game.winAmount = game.bet * 2;
        } else if (game.playerValue === game.dealerValue) {
            game.result = 'tie';
            game.winAmount = game.bet;
        } else {
            game.result = 'lose';
            game.winAmount = 0;
        }

        game.status = 'completed';
        this.activeGames.delete(gameId);

        this.log(`Blackjack game completed for user ${userId}`, 'debug', { result: game.result });

        return game;
    }

    /**
     * Get active blackjack game
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Object|null} Game state or null
     */
    getBlackjackGame(userId, guildId) {
        const gameId = `${guildId}-${userId}-blackjack`;
        return this.activeGames.get(gameId) || null;
    }

    /**
     * Play roulette
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} bet - Bet amount
     * @param {string} betType - Bet type (red, black, even, odd, number)
     * @param {number} betValue - Bet value (for number bets)
     * @returns {Object} Game result
     */
    playRoulette(userId, guildId, bet, betType, betValue = null) {
        // Spin the wheel (0-36)
        const result = Math.floor(Math.random() * 37);

        // Determine color (0 is green, 1-10 and 19-28 alternate red/black, 11-18 and 29-36 alternate black/red)
        let color = 'green';
        if (result !== 0) {
            const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
            color = redNumbers.includes(result) ? 'red' : 'black';
        }

        const isEven = result !== 0 && result % 2 === 0;

        let won = false;
        let multiplier = 0;

        // Check win conditions
        switch (betType) {
            case 'red':
                won = color === 'red';
                multiplier = 2;
                break;
            case 'black':
                won = color === 'black';
                multiplier = 2;
                break;
            case 'green':
                won = color === 'green';
                multiplier = 14;
                break;
            case 'even':
                won = isEven;
                multiplier = 2;
                break;
            case 'odd':
                won = !isEven && result !== 0;
                multiplier = 2;
                break;
            case 'number':
                won = result === betValue;
                multiplier = 35;
                break;
        }

        const winAmount = won ? bet * multiplier : 0;

        this.log(`Roulette played by user ${userId}`, 'debug', { result, betType, won });

        return {
            type: 'roulette',
            userId,
            guildId,
            bet,
            betType,
            betValue,
            result,
            color,
            won,
            winAmount
        };
    }

    /**
     * Play slots
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} bet - Bet amount
     * @returns {Object} Game result
     */
    playSlots(userId, guildId, bet) {
        const symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];

        // Spin the slots
        const reels = [
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)]
        ];

        let won = false;
        let multiplier = 0;

        // Check for wins
        if (reels[0] === reels[1] && reels[1] === reels[2]) {
            // Three of a kind
            won = true;

            switch (reels[0]) {
                case '7️⃣':
                    multiplier = 10;
                    break;
                case '💎':
                    multiplier = 7;
                    break;
                case '🔔':
                    multiplier = 5;
                    break;
                default:
                    multiplier = 3;
            }
        } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
            // Two of a kind
            won = true;
            multiplier = 1.5;
        }

        const winAmount = won ? Math.floor(bet * multiplier) : 0;

        this.log(`Slots played by user ${userId}`, 'debug', { reels, won });

        return {
            type: 'slots',
            userId,
            guildId,
            bet,
            reels,
            won,
            winAmount
        };
    }

    /**
     * Play coinflip
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} bet - Bet amount
     * @param {string} choice - User's choice (heads or tails)
     * @returns {Object} Game result
     */
    playCoinflip(userId, guildId, bet, choice) {
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const won = result === choice.toLowerCase();
        const winAmount = won ? bet * 2 : 0;

        this.log(`Coinflip played by user ${userId}`, 'debug', { choice, result, won });

        return {
            type: 'coinflip',
            userId,
            guildId,
            bet,
            choice,
            result,
            won,
            winAmount
        };
    }

    /**
     * Cleanup expired games
     */
    cleanupExpiredGames() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [gameId, game] of this.activeGames.entries()) {
            if (now - game.createdAt > this.gameExpirationMs) {
                this.activeGames.delete(gameId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.log(`Cleaned up ${cleanedCount} expired games`, 'debug');
        }
    }

    /**
     * Create a standard 52-card deck
     * @returns {Array} Deck of cards
     */
    createDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const deck = [];

        for (const suit of suits) {
            for (const rank of ranks) {
                deck.push({ rank, suit });
            }
        }

        return deck;
    }

    /**
     * Shuffle a deck using Fisher-Yates algorithm
     * @param {Array} deck - Deck to shuffle
     */
    shuffleDeck(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }

    /**
     * Calculate blackjack hand value
     * @param {Array} hand - Array of cards
     * @returns {number} Hand value
     */
    calculateBlackjackValue(hand) {
        let value = 0;
        let aces = 0;

        for (const card of hand) {
            if (card.rank === 'A') {
                aces++;
                value += 11;
            } else if (['J', 'Q', 'K'].includes(card.rank)) {
                value += 10;
            } else {
                value += parseInt(card.rank);
            }
        }

        // Adjust for aces
        while (value > 21 && aces > 0) {
            value -= 10;
            aces--;
        }

        return value;
    }

    /**
     * Format card for display
     * @param {Object} card - Card object
     * @returns {string} Formatted card string
     */
    formatCard(card) {
        return `${card.rank}${card.suit}`;
    }

    /**
     * Format hand for display
     * @param {Array} hand - Array of cards
     * @returns {string} Formatted hand string
     */
    formatHand(hand) {
        return hand.map(card => this.formatCard(card)).join(' ');
    }
}

module.exports = GameService;
