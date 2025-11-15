/**
 * ModerationController
 * 
 * Handles all moderation-related commands
 * Thin controller layer that delegates to ModerationService
 */

const Controller = require('../../system/core/Controller');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const { replyEphemeral, deferEphemeral } = require('../../system/helpers/interaction_helper');

class ModerationController extends Controller {
    /**
     * Create a new ModerationController instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client);

        // Get services from moderation module
        const moderationModule = this.client.modules.get('moderation');
        this.moderationService = moderationModule ? moderationModule.getService('ModerationService') : null;
        this.infractionService = moderationModule ? moderationModule.getService('InfractionService') : null;
    }



    /**
     * Warn command handler
     * Issues a warning to a user
     * @param {Object} interaction - Discord interaction
     */
    async warn(interaction) {
        try {
            if (!this.moderationService) {
                await this.sendError(interaction, 'Moderation service not available');
                return;
            }

            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason');

            // If reason is provided, execute warn directly
            if (reason) {
                const result = await this.moderationService.warnMember(
                    interaction.guild,
                    user,
                    interaction.user,
                    reason
                );

                if (!result.success) {
                    await interaction.reply({ content: `❌ ${result.error}` });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setColor(0xe67e22)
                    .setTitle('⚠️ User Warned')
                    .setDescription(`${user} has been warned`)
                    .addFields(
                        { name: 'Reason', value: reason },
                        { name: 'Moderator', value: `${interaction.user}` },
                        { name: 'Warning ID', value: result.warning.id.toString() }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
            } else {
                // Show modal to collect reason
                const modal = new ModalBuilder()
                    .setCustomId('warn_reason_modal')
                    .setTitle('Warn User');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('warn_reason_input')
                    .setLabel('Reason for warning')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Enter the reason for this warning...')
                    .setRequired(true)
                    .setMinLength(5)
                    .setMaxLength(500);

                const row = new ActionRowBuilder().addComponents(reasonInput);
                modal.addComponents(row);

                // Store pending warn data in guild state
                if (!this.client.guildStates) {
                    this.client.guildStates = new Map();
                }

                let guildState = this.client.guildStates.get(interaction.guild.id) || {};
                if (!guildState.pendingWarn) {
                    guildState.pendingWarn = {};
                }

                guildState.pendingWarn[interaction.user.id] = {
                    target: user,
                    timestamp: Date.now()
                };

                this.client.guildStates.set(interaction.guild.id, guildState);

                await interaction.showModal(modal);

                // Set timeout to clean up after 5 minutes
                setTimeout(() => {
                    const state = this.client.guildStates.get(interaction.guild.id);
                    if (state && state.pendingWarn && state.pendingWarn[interaction.user.id]) {
                        delete state.pendingWarn[interaction.user.id];
                        this.client.guildStates.set(interaction.guild.id, state);
                    }
                }, 300000);
            }
        } catch (error) {
            this.log(`Error in warn command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to warn user');
        }
    }

    /**
     * Kick command handler
     * Kicks a user from the server
     * @param {Object} interaction - Discord interaction
     */
    async kick(interaction) {
        try {
            if (!this.moderationService) {
                await this.sendError(interaction, 'Moderation service not available');
                return;
            }

            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);

            if (!member) {
                await interaction.reply({ content: '❌ User not found in this server' });
                return;
            }

            // Show confirmation prompt
            const embed = new EmbedBuilder()
                .setColor(0xe67e22)
                .setTitle('⚠️ Confirm Kick')
                .setDescription(`Are you sure you want to kick **${user.tag}**?`)
                .addFields(
                    { name: 'User', value: `${user} (${user.id})`, inline: true },
                    { name: 'Reason', value: reason, inline: true }
                )
                .setFooter({ text: 'This confirmation will expire in 30 seconds' })
                .setTimestamp();

            const confirmButton = new ButtonBuilder()
                .setCustomId('kick_confirm')
                .setLabel('Confirm Kick')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('👢');

            const cancelButton = new ButtonBuilder()
                .setCustomId('kick_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌');

            const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            // Store pending kick data in guild state
            if (!this.client.guildStates) {
                this.client.guildStates = new Map();
            }

            let guildState = this.client.guildStates.get(interaction.guild.id) || {};
            if (!guildState.pendingKick) {
                guildState.pendingKick = {};
            }

            guildState.pendingKick[interaction.user.id] = {
                targetId: user.id,
                reason: reason,
                timestamp: Date.now()
            };

            this.client.guildStates.set(interaction.guild.id, guildState);

            await interaction.reply({ embeds: [embed], components: [row] });

            // Set timeout to clean up after 30 seconds
            setTimeout(() => {
                const state = this.client.guildStates.get(interaction.guild.id);
                if (state && state.pendingKick && state.pendingKick[interaction.user.id]) {
                    delete state.pendingKick[interaction.user.id];
                    this.client.guildStates.set(interaction.guild.id, state);
                }
            }, 30000);
        } catch (error) {
            this.log(`Error in kick command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to kick user');
        }
    }

    /**
     * Ban command handler
     * Bans a user from the server
     * @param {Object} interaction - Discord interaction
     */
    async ban(interaction) {
        try {
            if (!this.moderationService) {
                await this.sendError(interaction, 'Moderation service not available');
                return;
            }

            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const deleteMessages = interaction.options.getInteger('delete_messages') || 0;

            // Show confirmation prompt
            const embed = new EmbedBuilder()
                .setColor(0xe67e22)
                .setTitle('⚠️ Confirm Ban')
                .setDescription(`Are you sure you want to ban **${user.tag}**?`)
                .addFields(
                    { name: 'User', value: `${user} (${user.id})`, inline: true },
                    { name: 'Reason', value: reason, inline: true },
                    { name: 'Delete Messages', value: `${deleteMessages} days`, inline: true }
                )
                .setFooter({ text: 'This confirmation will expire in 30 seconds' })
                .setTimestamp();

            const confirmButton = new ButtonBuilder()
                .setCustomId('ban_confirm')
                .setLabel('Confirm Ban')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔨');

            const cancelButton = new ButtonBuilder()
                .setCustomId('ban_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌');

            const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            // Store pending ban data in guild state
            if (!this.client.guildStates) {
                this.client.guildStates = new Map();
            }

            let guildState = this.client.guildStates.get(interaction.guild.id) || {};
            if (!guildState.pendingBan) {
                guildState.pendingBan = {};
            }

            guildState.pendingBan[interaction.user.id] = {
                target: user,
                reason: reason,
                deleteMessages: deleteMessages,
                timestamp: Date.now()
            };

            this.client.guildStates.set(interaction.guild.id, guildState);

            await interaction.reply({ embeds: [embed], components: [row] });

            // Set timeout to clean up after 30 seconds
            setTimeout(() => {
                const state = this.client.guildStates.get(interaction.guild.id);
                if (state && state.pendingBan && state.pendingBan[interaction.user.id]) {
                    delete state.pendingBan[interaction.user.id];
                    this.client.guildStates.set(interaction.guild.id, state);
                }
            }, 30000);
        } catch (error) {
            this.log(`Error in ban command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to ban user');
        }
    }

    /**
     * Unban command handler
     * Unbans a user from the server
     * @param {Object} interaction - Discord interaction
     */
    async unban(interaction) {
        try {
            if (!this.moderationService) {
                await this.sendError(interaction, 'Moderation service not available');
                return;
            }

            const userId = interaction.options.getString('user_id');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            // Delegate to service
            const result = await this.moderationService.unbanMember(
                interaction.guild,
                userId,
                interaction.user,
                reason
            );

            if (!result.success) {
                await interaction.reply({ content: `❌ ${result.error}` });
                return;
            }

            await interaction.reply(`✅ Unbanned user: ${result.user.tag} (${userId})`);
        } catch (error) {
            this.log(`Error in unban command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to unban user');
        }
    }

    /**
     * Timeout command handler
     * Times out a user
     * @param {Object} interaction - Discord interaction
     */
    async timeout(interaction) {
        try {
            if (!this.moderationService) {
                await this.sendError(interaction, 'Moderation service not available');
                return;
            }

            const user = interaction.options.getUser('user');
            const duration = interaction.options.getInteger('duration');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);

            if (!member) {
                await interaction.reply({ content: '❌ User not found in this server' });
                return;
            }

            // Delegate to service
            const result = await this.moderationService.timeoutMember(
                interaction.guild,
                member,
                interaction.user,
                duration,
                reason
            );

            if (!result.success) {
                await interaction.reply({ content: `❌ ${result.error}` });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x95a5a6)
                .setTitle('⏱️ User Timed Out')
                .setDescription(`${user} has been timed out for ${duration} minutes`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Moderator', value: `${interaction.user}` }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            this.log(`Error in timeout command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to timeout user');
        }
    }

    /**
     * Purge command handler
     * Deletes multiple messages
     * @param {Object} interaction - Discord interaction
     */
    async purge(interaction) {
        try {
            const amount = interaction.options.getInteger('amount');

            if (amount < 1 || amount > 100) {
                await interaction.reply({ content: '❌ Amount must be between 1 and 100' });
                return;
            }

            await deferEphemeral(interaction);

            const messages = await interaction.channel.bulkDelete(amount, true);

            await interaction.editReply(`✅ Deleted ${messages.size} messages`);
            this.log(`Purged ${messages.size} messages in channel ${interaction.channel.id}`, 'info');
        } catch (error) {
            this.log(`Error in purge command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to purge messages');
        }
    }

    /**
     * Warnings command handler
     * Displays user's warnings
     * @param {Object} interaction - Discord interaction
     */
    async warnings(interaction) {
        try {
            if (!this.moderationService) {
                await this.sendError(interaction, 'Moderation service not available');
                return;
            }

            const user = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;

            // Delegate to service
            const warnings = await this.moderationService.getWarnings(user.id, guildId);

            if (warnings.length === 0) {
                await interaction.reply({ content: `${user} has no warnings` });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0xe67e22)
                .setTitle(`⚠️ Warnings for ${user.tag}`)
                .setDescription(warnings.map((w, i) => `**${i + 1}.** ${w.reason} - <t:${Math.floor(w.timestamp / 1000)}:R>`).join('\n'))
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            this.log(`Error in warnings command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to fetch warnings');
        }
    }
}

module.exports = ModerationController;
