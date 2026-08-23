/**
 * EconomyController
 * 
 * Handles all economy-related commands
 * Manages currency, games, shop, and transactions with modern ResponseHelper UI.
 */

const Controller = require('../../system/core/Controller');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ResponseHelper = require('../../system/helpers/ResponseHelper');

class EconomyController extends Controller {
    /**
     * Create a new EconomyController instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client);

        // Load models (for fallback)
        this.economyModel = this.load.model('EconomyModel');

        // Get services from economy module
        const economyModule = this.client.modules.get('economy');
        if (economyModule) {
            this.economyService = economyModule.getService('EconomyService');
            this.gameService = economyModule.getService('GameService');
            this.shopService = economyModule.getService('ShopService');
        }
    }

    /**
     * Lazy load economy service if not already loaded
     */
    getEconomyService() {
        if (this.economyService) return this.economyService;
        const mod = this.client.modules.get('economy');
        if (mod) this.economyService = mod.getService('EconomyService');
        return this.economyService;
    }

    /**
     * Lazy load game service
     */
    getGameService() {
        if (this.gameService) return this.gameService;
        const mod = this.client.modules.get('economy');
        if (mod) this.gameService = mod.getService('GameService');
        return this.gameService;
    }

    /**
     * Lazy load shop service
     */
    getShopService() {
        if (this.shopService) return this.shopService;
        const mod = this.client.modules.get('economy');
        if (mod) this.shopService = mod.getService('ShopService');
        return this.shopService;
    }

    /**
     * Balance command handler
     * Displays user's balance
     */
    async balance(interaction) {
        try {
            const user = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;

            const service = this.getEconomyService();
            let balance;

            if (service) {
                balance = await service.getBalance(user.id, guildId);
            } else {
                const modelBalance = await this.economyModel.getUserBalance(user.id, guildId);
                balance = {
                    wallet: modelBalance.balance,
                    bank: modelBalance.bank_balance,
                    total: modelBalance.balance + modelBalance.bank_balance
                };
            }

            const embed = ResponseHelper.balanceCard(user, balance);
            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.log(`Error in balance command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to fetch balance profile');
        }
    }

    /**
     * Daily command handler
     * Claims daily reward
     */
    async daily(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            const service = this.getEconomyService();

            if (!service) {
                await this.sendError(interaction, 'Economy service is currently unavailable');
                return;
            }

            const result = await service.claimDaily(userId, guildId);

            if (!result.success) {
                const timeLeftStr = result.timeLeft
                    ? ResponseHelper.formatDuration(Math.ceil(result.timeLeft / 1000))
                    : 'a few hours';

                const embed = ResponseHelper.warning(
                    'Daily Reward on Cooldown',
                    `You have already claimed your daily reward today!\n\n**Next Claim Available In:** \`${timeLeftStr}\` ⏳`
                );
                await ResponseHelper.send(interaction, embed);
                return;
            }

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.SUCCESS,
                title: '🎁 Daily Reward Claimed!',
                thumbnail: 'https://cdn.discordapp.com/emojis/849313626159677461.webp',
                description: [
                    `Congratulations **${interaction.user.username}**! You claimed your daily reward.`,
                    '',
                    `**Reward Amount:** ${ResponseHelper.formatMoney(result.amount)}`,
                    `**Daily Streak:** \`🔥 ${result.streak || 1} Days\``,
                    `**New Wallet Balance:** ${ResponseHelper.formatMoney(result.newBalance)}`,
                    '',
                    ResponseHelper.subtext('Come back every 24 hours to keep your streak bonus alive!')
                ].join('\n'),
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.log(`Error in daily command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to claim daily reward');
        }
    }

    /**
     * Work command handler
     * Earns money by working
     */
    async work(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            const service = this.getEconomyService();

            if (!service) {
                await this.sendError(interaction, 'Economy service is currently unavailable');
                return;
            }

            const result = await service.work(userId, guildId);

            if (!result.success) {
                const timeLeftStr = result.timeLeft
                    ? ResponseHelper.formatDuration(Math.ceil(result.timeLeft / 1000))
                    : 'a few minutes';

                const embed = ResponseHelper.warning(
                    'Work Shift Cooldown',
                    `You are tired from your last shift! Take a rest before working again.\n\n**Next Shift Available In:** \`${timeLeftStr}\` ⏱️`
                );
                await ResponseHelper.send(interaction, embed);
                return;
            }

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.ECONOMY,
                title: '💼 Shift Completed!',
                description: [
                    `**${interaction.user.username}**, you worked as a **${result.job || 'Freelancer'}**!`,
                    '',
                    `**Earnings:** ${ResponseHelper.formatMoney(result.amount)}`,
                    `**New Balance:** ${ResponseHelper.formatMoney(result.newBalance)}`,
                ].join('\n'),
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.log(`Error in work command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to complete work shift');
        }
    }

    /**
     * Transfer command handler
     * Transfers money to another user
     */
    async transfer(interaction) {
        try {
            const recipient = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const senderId = interaction.user.id;
            const guildId = interaction.guild.id;

            if (recipient.id === senderId) {
                await this.sendError(interaction, 'You cannot transfer coins to yourself!');
                return;
            }

            if (recipient.bot) {
                await this.sendError(interaction, 'You cannot transfer coins to Discord bots!');
                return;
            }

            if (amount <= 0) {
                await this.sendError(interaction, 'Transfer amount must be greater than 0!');
                return;
            }

            const service = this.getEconomyService();
            if (!service) {
                await this.sendError(interaction, 'Economy service is currently unavailable');
                return;
            }

            const result = await service.transfer(senderId, recipient.id, guildId, amount);

            if (!result.success) {
                await this.sendError(interaction, result.message || 'Transfer failed');
                return;
            }

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.SUCCESS,
                title: '💸 Wire Transfer Successful',
                fields: [
                    { name: 'Sender', value: `${interaction.user} (\`${interaction.user.username}\`)`, inline: true },
                    { name: 'Recipient', value: `${recipient} (\`${recipient.username}\`)`, inline: true },
                    { name: 'Amount Transferred', value: ResponseHelper.formatMoney(amount), inline: true },
                    { name: 'Transaction Tax (5%)', value: ResponseHelper.formatMoney(result.tax || 0), inline: true },
                    { name: 'Your Remaining Balance', value: ResponseHelper.formatMoney(result.senderBalance), inline: true },
                ],
                footerText: 'EyeDaemon Bank Transfer • Instant Settlement'
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.log(`Error in transfer command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to process transfer');
        }
    }

    /**
     * Deposit command handler
     * Deposits cash into bank
     */
    async deposit(interaction) {
        try {
            const amount = interaction.options.getInteger('amount');
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;

            const service = this.getEconomyService();
            if (!service) {
                await this.sendError(interaction, 'Economy service is currently unavailable');
                return;
            }

            const result = await service.deposit(userId, guildId, amount);
            if (!result.success) {
                await this.sendError(interaction, result.message || 'Deposit failed');
                return;
            }

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.ECONOMY,
                title: '🏦 Bank Deposit Receipt',
                fields: [
                    { name: 'Amount Deposited', value: ResponseHelper.formatMoney(amount), inline: true },
                    { name: 'Wallet Balance', value: ResponseHelper.formatMoney(result.wallet), inline: true },
                    { name: 'Bank Balance', value: ResponseHelper.formatMoney(result.bank), inline: true },
                ],
                footerText: 'Your coins in the bank are protected from blackjack bets!'
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.log(`Error in deposit command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to deposit money into bank');
        }
    }

    /**
     * Withdraw command handler
     * Withdraws money from bank
     */
    async withdraw(interaction) {
        try {
            const amount = interaction.options.getInteger('amount');
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;

            const service = this.getEconomyService();
            if (!service) {
                await this.sendError(interaction, 'Economy service is currently unavailable');
                return;
            }

            const result = await service.withdraw(userId, guildId, amount);
            if (!result.success) {
                await this.sendError(interaction, result.message || 'Withdrawal failed');
                return;
            }

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.ECONOMY,
                title: '🏧 Bank Withdrawal Receipt',
                fields: [
                    { name: 'Amount Withdrawn', value: ResponseHelper.formatMoney(amount), inline: true },
                    { name: 'Wallet Balance', value: ResponseHelper.formatMoney(result.wallet), inline: true },
                    { name: 'Bank Balance', value: ResponseHelper.formatMoney(result.bank), inline: true },
                ],
                footerText: 'EyeDaemon ATM • Cash Dispensed'
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.log(`Error in withdraw command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to withdraw money from bank');
        }
    }

    /**
     * Blackjack command handler
     * Starts a new blackjack casino round
     */
    async blackjack(interaction) {
        try {
            const bet = interaction.options.getInteger('bet');
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;

            const gameService = this.getGameService();
            const economyService = this.getEconomyService();

            if (!gameService || !economyService) {
                await this.sendError(interaction, 'Game service is currently unavailable');
                return;
            }

            if (bet <= 0) {
                await this.sendError(interaction, 'Bet amount must be positive!');
                return;
            }

            // Verify player balance
            const balance = await economyService.getBalance(userId, guildId);
            if (balance.wallet < bet) {
                await this.sendError(interaction, `Insufficient cash wallet! You have ${ResponseHelper.formatMoney(balance.wallet)}, but tried to bet ${ResponseHelper.formatMoney(bet)}.`);
                return;
            }

            // Deduct bet amount
            await economyService.deductBalance(userId, guildId, bet, 'Blackjack initial bet');

            // Create new game
            const game = gameService.createBlackjackGame(userId, guildId, bet);
            const embed = ResponseHelper.blackjackCard(game);

            // Create Hit and Stand interactive buttons
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('blackjack_hit')
                    .setLabel('Hit (Draw Card)')
                    .setEmoji('🃏')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('blackjack_stand')
                    .setLabel('Stand (End Turn)')
                    .setEmoji('🛑')
                    .setStyle(ButtonStyle.Secondary)
            );

            await ResponseHelper.send(interaction, { embeds: [embed], components: [row] });
        } catch (error) {
            this.log(`Error in blackjack command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to start blackjack game');
        }
    }

    /**
     * Shop command handler
     * Displays available items in the guild shop
     */
    async shop(interaction) {
        try {
            const guildId = interaction.guild.id;
            const shopService = this.getShopService();

            if (!shopService) {
                await this.sendError(interaction, 'Shop service is currently unavailable');
                return;
            }

            const items = await shopService.getItems(guildId);

            if (!items || items.length === 0) {
                const embed = ResponseHelper.info(
                    'Guild Shop Catalog',
                    'The shop is currently empty! Server administrators can add items using shop management commands.'
                );
                await ResponseHelper.send(interaction, embed);
                return;
            }

            const itemLines = items.map((item, index) => {
                const stockStr = item.stock === -1 ? '`Unlimited`' : `\`${item.stock} left\``;
                return `**${index + 1}. ${item.name}** — ${ResponseHelper.formatMoney(item.price)}\n> ${item.description || 'No description'}\n> **Stock:** ${stockStr} • **Item ID:** \`${item.id}\``;
            });

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.ECONOMY,
                title: `🛍️ ${interaction.guild.name} Shop`,
                description: [
                    'Welcome to the server marketplace! Use `/shop-buy item:<id>` to purchase.',
                    '',
                    ...itemLines
                ].join('\n'),
                footerText: 'Items purchased are automatically added to your /inventory'
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.log(`Error in shop command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to fetch guild shop items');
        }
    }

    /**
     * Shop Buy command handler
     */
    async shopBuy(interaction) {
        try {
            const itemId = interaction.options.getString('item');
            const quantity = interaction.options.getInteger('quantity') || 1;
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;

            const shopService = this.getShopService();
            if (!shopService) {
                await this.sendError(interaction, 'Shop service is currently unavailable');
                return;
            }

            const result = await shopService.purchaseItem(userId, guildId, itemId, quantity);
            if (!result.success) {
                await this.sendError(interaction, result.message || 'Purchase failed');
                return;
            }

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.SUCCESS,
                title: '🛍️ Item Purchased Successfully!',
                fields: [
                    { name: 'Item', value: `**${result.item.name}**`, inline: true },
                    { name: 'Quantity', value: `\`x${quantity}\``, inline: true },
                    { name: 'Total Cost', value: ResponseHelper.formatMoney(result.totalPrice), inline: true },
                    { name: 'Remaining Balance', value: ResponseHelper.formatMoney(result.newBalance), inline: true },
                ],
                footerText: 'View your purchased items anytime with /inventory'
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.log(`Error in shopBuy command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to process item purchase');
        }
    }

    /**
     * Inventory command handler
     * Displays user's inventory
     */
    async inventory(interaction) {
        try {
            const user = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;

            const shopService = this.getShopService();
            if (!shopService) {
                await this.sendError(interaction, 'Shop service is currently unavailable');
                return;
            }

            const items = await shopService.getInventory(user.id, guildId);

            if (!items || items.length === 0) {
                const embed = ResponseHelper.info(
                    'User Inventory',
                    `**${user.username}** does not have any items in their inventory yet! Check out the \`/shop\` to buy roles and rewards.`
                );
                await ResponseHelper.send(interaction, embed);
                return;
            }

            const itemLines = items.map((item, index) => {
                return `**${index + 1}. ${item.name}** \`(x${item.quantity})\`\n> ${item.description || 'No description'}\n> Acquired: ${ResponseHelper.formatTimestamp(item.created_at, 'R')}`;
            });

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.ECONOMY,
                author: { name: `${user.username}'s Inventory Backpack`, iconURL: user.displayAvatarURL?.() || undefined },
                description: itemLines.join('\n\n'),
                footerText: `Total Items: ${items.length}`
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.log(`Error in inventory command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to fetch inventory');
        }
    }
}

module.exports = EconomyController;
