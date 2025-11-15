/**
 * EconomyController
 * 
 * Handles all economy-related commands
 * Manages currency, games, shop, and transactions
 */

const Controller = require('../../system/core/Controller');
const { EmbedBuilder } = require('discord.js');
const { replyEphemeral } = require('../../system/helpers/interaction_helper');

class EconomyController extends Controller {
    /**
     * Create a new EconomyController instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client);

        // Load models (kept for backward compatibility)
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
     * Balance command handler
     * Displays user's balance
     * @param {Object} interaction - Discord interaction
     */
    async balance(interaction) {
        try {
            const user = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;

            // Use service if available, fallback to model
            let balance;
            if (this.economyService) {
                balance = await this.economyService.getBalance(user.id, guildId);
            } else {
                const modelBalance = await this.economyModel.getUserBalance(user.id, guildId);
                balance = {
                    wallet: modelBalance.balance,
                    bank: modelBalance.bank_balance,
                    total: modelBalance.balance + modelBalance.bank_balance
                };
            }

            const embed = new EmbedBuilder()
                .setColor(0xf1c40f)
                .setTitle('💰 Balance')
                .setDescription(`Balance for **${user.tag}**`)
                .addFields(
                    { name: 'Wallet', value: `${balance.wallet} coins`, inline: true },
                    { name: 'Bank', value: `${balance.bank} coins`, inline: true },
                    { name: 'Total', value: `${balance.total} coins`, inline: true }
                )
                .setThumbnail(user.displayAvatarURL())
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            this.log(`Error in balance command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to fetch balance');
        }
    }

    /**
     * Daily command handler
     * Claims daily reward
     * @param {Object} interaction - Discord interaction
     */
    async daily(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;

            const result = await this.economyModel.claimDaily(userId, guildId);

            if (!result.success) {
                const timeLeft = this.formatTime(result.timeLeft);
                await replyEphemeral(interaction, `❌ You already claimed your daily reward! Come back in **${timeLeft}**`);
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('🎁 Daily Reward')
                .setDescription(`You claimed your daily reward of **${result.amount} coins**!`)
                .addFields(
                    { name: 'New Balance', value: `${result.newBalance} coins`, inline: true },
                    { name: 'Streak', value: `${result.streak} day${result.streak !== 1 ? 's' : ''}`, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            this.log(`User ${userId} claimed daily reward`, 'info');
        } catch (error) {
            this.log(`Error in daily command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to claim daily reward');
        }
    }

    /**
     * Work command handler
     * Earns money from working
     * @param {Object} interaction - Discord interaction
     */
    async work(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;

            const result = await this.economyModel.work(userId, guildId);

            if (!result.success) {
                const timeLeft = this.formatTime(result.timeLeft);
                await replyEphemeral(interaction, `❌ You're tired! Rest for **${timeLeft}** before working again`);
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('💼 Work')
                .setDescription(`${result.message}\n\nYou earned **${result.amount} coins**!`)
                .addFields(
                    { name: 'New Balance', value: `${result.newBalance} coins`, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            this.log(`User ${userId} worked and earned ${result.amount} coins`, 'info');
        } catch (error) {
            this.log(`Error in work command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to work');
        }
    }

    /**
     * Transfer command handler
     * Transfers money to another user
     * @param {Object} interaction - Discord interaction
     */
    async transfer(interaction) {
        try {
            const userId = interaction.user.id;
            const targetUser = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const guildId = interaction.guild.id;

            if (targetUser.id === userId) {
                await replyEphemeral(interaction, '❌ You cannot transfer money to yourself');
                return;
            }

            if (targetUser.bot) {
                await replyEphemeral(interaction, '❌ You cannot transfer money to bots');
                return;
            }

            // Use service if available, fallback to model
            let result;
            if (this.economyService) {
                result = await this.economyService.transfer(userId, targetUser.id, guildId, amount);
            } else {
                result = await this.economyModel.transfer(userId, targetUser.id, guildId, amount);
            }

            if (!result.success) {
                await replyEphemeral(interaction, `❌ ${result.message}`);
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('💸 Transfer')
                .setDescription(`Successfully transferred **${amount} coins** to ${targetUser}`)
                .addFields(
                    { name: 'Your New Balance', value: `${result.newBalance} coins`, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            this.log(`User ${userId} transferred ${amount} coins to ${targetUser.id}`, 'info');
        } catch (error) {
            this.log(`Error in transfer command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to transfer money');
        }
    }

    /**
     * Deposit command handler
     * Deposits money to bank
     * @param {Object} interaction - Discord interaction
     */
    async deposit(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            const amount = interaction.options.getInteger('amount');

            // Use service if available, fallback to model
            let result;
            if (this.economyService) {
                result = await this.economyService.deposit(userId, guildId, amount);
            } else {
                result = await this.economyModel.deposit(userId, guildId, amount);
            }

            if (!result.success) {
                await replyEphemeral(interaction, `❌ ${result.message}`);
                return;
            }

            await interaction.reply(`✅ Deposited **${amount} coins** to your bank`);
            this.log(`User ${userId} deposited ${amount} coins`, 'info');
        } catch (error) {
            this.log(`Error in deposit command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to deposit money');
        }
    }

    /**
     * Withdraw command handler
     * Withdraws money from bank
     * @param {Object} interaction - Discord interaction
     */
    async withdraw(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            const amount = interaction.options.getInteger('amount');

            // Use service if available, fallback to model
            let result;
            if (this.economyService) {
                result = await this.economyService.withdraw(userId, guildId, amount);
            } else {
                result = await this.economyModel.withdraw(userId, guildId, amount);
            }

            if (!result.success) {
                await replyEphemeral(interaction, `❌ ${result.message}`);
                return;
            }

            await interaction.reply(`✅ Withdrew **${amount} coins** from your bank`);
            this.log(`User ${userId} withdrew ${amount} coins`, 'info');
        } catch (error) {
            this.log(`Error in withdraw command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to withdraw money');
        }
    }

    /**
     * Blackjack command handler
     * Starts a blackjack game with interactive buttons
     * @param {Object} interaction - Discord interaction
     */
    async blackjack(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            const bet = interaction.options.getInteger('bet');

            // Check if user already has an active game
            const existingGame = this.gameService.getBlackjackGame(userId, guildId);
            if (existingGame && existingGame.status === 'active') {
                await replyEphemeral(interaction, '❌ You already have an active blackjack game! Finish it first.');
                return;
            }

            // Check balance
            const balance = await this.economyService.getBalance(userId, guildId);
            if (balance.wallet < bet) {
                await replyEphemeral(interaction, `❌ Insufficient balance! You have **${balance.wallet} coins** but need **${bet} coins**`);
                return;
            }

            // Deduct bet from balance
            await this.economyService.removeBalance(userId, guildId, bet, 'Blackjack bet');

            // Create game
            const game = this.gameService.createBlackjackGame(userId, guildId, bet);

            // Check for instant blackjack (21 on first two cards)
            if (game.playerValue === 21) {
                // Player has blackjack, auto-stand
                const finalGame = this.gameService.blackjackStand(userId, guildId);

                // Update balance
                if (finalGame.result === 'win') {
                    await this.economyService.addBalance(userId, guildId, finalGame.winAmount, 'Blackjack win');
                } else if (finalGame.result === 'tie') {
                    await this.economyService.addBalance(userId, guildId, finalGame.bet, 'Blackjack tie (refund)');
                }

                const embed = this.createBlackjackEmbed(finalGame, 'Blackjack!', 0x2ecc71);
                await interaction.reply({ embeds: [embed] });
                return;
            }

            // Create game embed and buttons
            const embed = this.createBlackjackEmbed(game, 'Blackjack', 0x3498db);
            const buttons = this.createBlackjackButtons();

            await interaction.reply({
                embeds: [embed],
                components: [buttons]
            });

            this.log(`User ${userId} started blackjack game with bet ${bet}`, 'info');
        } catch (error) {
            this.log(`Error in blackjack command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to start blackjack game');
        }
    }

    /**
     * Create blackjack game embed
     * @param {Object} game - Game state
     * @param {string} title - Embed title
     * @param {number} color - Embed color
     * @returns {EmbedBuilder} Game embed
     */
    createBlackjackEmbed(game, title, color) {
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`🃏 ${title}`)
            .addFields(
                {
                    name: 'Your Hand',
                    value: `${this.gameService.formatHand(game.playerHand)}\n**Value: ${game.playerValue}**`,
                    inline: true
                },
                {
                    name: 'Dealer Hand',
                    value: game.status === 'active'
                        ? `${this.gameService.formatCard(game.dealerHand[0])} 🂠\n**Value: ?**`
                        : `${this.gameService.formatHand(game.dealerHand)}\n**Value: ${game.dealerValue}**`,
                    inline: true
                },
                {
                    name: 'Bet',
                    value: `${game.bet} coins`,
                    inline: true
                }
            )
            .setTimestamp();

        // Add result field if game is over
        if (game.status !== 'active') {
            let resultText = '';
            if (game.result === 'win') {
                resultText = `🎉 You won **${game.winAmount} coins**!`;
            } else if (game.result === 'lose') {
                resultText = `💔 You lost **${game.bet} coins**`;
            } else if (game.result === 'tie') {
                resultText = `🤝 It's a tie! You get your **${game.bet} coins** back`;
            }

            embed.addFields({
                name: 'Result',
                value: resultText,
                inline: false
            });
        }

        return embed;
    }

    /**
     * Create blackjack control buttons
     * @returns {ActionRowBuilder} Button row
     */
    createBlackjackButtons() {
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const hitButton = new ButtonBuilder()
            .setCustomId('blackjack_hit')
            .setLabel('Hit')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎴');

        const standButton = new ButtonBuilder()
            .setCustomId('blackjack_stand')
            .setLabel('Stand')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✋');

        return new ActionRowBuilder().addComponents(hitButton, standButton);
    }

    /**
     * Shop command handler
     * Displays all items in the server shop
     * @param {Object} interaction - Discord interaction
     */
    async shop(interaction) {
        try {
            const guildId = interaction.guild.id;

            const items = await this.shopService.getItems(guildId);

            if (!items || items.length === 0) {
                await replyEphemeral(interaction, '🏪 The shop is empty! No items available for purchase.');
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('🏪 Server Shop')
                .setDescription('Available items for purchase')
                .setTimestamp();

            for (const item of items) {
                const stockText = item.stock === -1 ? 'Unlimited' : `${item.stock} left`;
                const roleText = item.role_id ? `\n🎭 Grants role: <@&${item.role_id}>` : '';

                embed.addFields({
                    name: `${item.name} - ${item.price} coins`,
                    value: `${item.description}\n📦 Stock: ${stockText}${roleText}\n\`ID: ${item.id}\``,
                    inline: false
                });
            }

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            this.log(`Error in shop command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to load shop');
        }
    }

    /**
     * Shop buy command handler
     * Initiates a purchase with confirmation buttons
     * @param {Object} interaction - Discord interaction
     */
    async shopBuy(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            const itemIdentifier = interaction.options.getString('item');
            const quantity = interaction.options.getInteger('quantity') || 1;

            // Get all items to find by name or ID
            const items = await this.shopService.getItems(guildId);
            let item = items.find(i => i.id === itemIdentifier || i.name.toLowerCase() === itemIdentifier.toLowerCase());

            if (!item) {
                await replyEphemeral(interaction, `❌ Item not found. Use \`/shop\` to see available items.`);
                return;
            }

            // Check stock
            if (item.stock !== -1 && item.stock < quantity) {
                await replyEphemeral(interaction, `❌ Insufficient stock. Available: ${item.stock}`);
                return;
            }

            const totalPrice = item.price * quantity;

            // Check balance
            const balance = await this.economyService.getBalance(userId, guildId);
            if (balance.wallet < totalPrice) {
                await replyEphemeral(interaction, `❌ Insufficient balance! You have **${balance.wallet} coins** but need **${totalPrice} coins**`);
                return;
            }

            // Create confirmation embed
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

            const embed = new EmbedBuilder()
                .setColor(0xf39c12)
                .setTitle('🛒 Confirm Purchase')
                .setDescription(`Are you sure you want to buy **${quantity}x ${item.name}**?`)
                .addFields(
                    { name: 'Item', value: item.name, inline: true },
                    { name: 'Quantity', value: quantity.toString(), inline: true },
                    { name: 'Total Cost', value: `${totalPrice} coins`, inline: true },
                    { name: 'Your Balance', value: `${balance.wallet} coins`, inline: true },
                    { name: 'Balance After', value: `${balance.wallet - totalPrice} coins`, inline: true }
                )
                .setFooter({ text: `Item ID: ${item.id} | Quantity: ${quantity}` })
                .setTimestamp();

            const confirmButton = new ButtonBuilder()
                .setCustomId('shop_buy_confirm')
                .setLabel('Confirm Purchase')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅');

            const cancelButton = new ButtonBuilder()
                .setCustomId('shop_buy_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌');

            const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            await interaction.reply({
                embeds: [embed],
                components: [row],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            this.log(`Error in shop-buy command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to process purchase request');
        }
    }

    /**
     * Inventory command handler
     * Displays user's inventory
     * @param {Object} interaction - Discord interaction
     */
    async inventory(interaction) {
        try {
            const user = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;

            const inventory = await this.shopService.getInventory(user.id, guildId);

            if (!inventory || inventory.length === 0) {
                await replyEphemeral(interaction, `📦 ${user.id === interaction.user.id ? 'Your' : `${user.tag}'s`} inventory is empty!`);
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle(`📦 ${user.tag}'s Inventory`)
                .setThumbnail(user.displayAvatarURL())
                .setTimestamp();

            for (const item of inventory) {
                const roleText = item.role_id ? `\n🎭 Role: <@&${item.role_id}>` : '';
                embed.addFields({
                    name: `${item.name} (x${item.quantity})`,
                    value: `${item.description}${roleText}\n💰 Value: ${item.price} coins each`,
                    inline: false
                });
            }

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            this.log(`Error in inventory command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to load inventory');
        }
    }

    /**
     * Format time to readable string
     * @param {number} ms - Time in milliseconds
     * @returns {string} Formatted time
     */
    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }
}

module.exports = EconomyController;
