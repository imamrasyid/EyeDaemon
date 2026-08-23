/**
 * ModerationController
 * 
 * Handles all moderation-related commands
 * Thin controller layer that delegates to ModerationService with ResponseHelper UI.
 */

const Controller = require('../../system/core/Controller');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const ResponseHelper = require('../../system/helpers/ResponseHelper');

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
     * Lazy load moderation service
     */
    getModerationService() {
        if (this.moderationService) return this.moderationService;
        const mod = this.client.modules.get('moderation');
        if (mod) this.moderationService = mod.getService('ModerationService');
        return this.moderationService;
    }

    /**
     * Warn command handler
     * Issues a warning to a user
     */
    async warn(interaction) {
        try {
            const service = this.getModerationService();
            if (!service) {
                await this.sendError(interaction, 'Moderation service is currently unavailable');
                return;
            }

            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason');

            if (reason) {
                const result = await service.warnMember(
                    interaction.guild,
                    user,
                    interaction.user,
                    reason
                );

                if (!result.success) {
                    await this.sendError(interaction, result.error || 'Failed to issue warning');
                    return;
                }

                const embed = ResponseHelper.moderationCard({
                    action: 'WARN',
                    target: user,
                    moderator: interaction.user,
                    reason,
                    caseId: result.warning?.id,
                });

                await ResponseHelper.send(interaction, embed);
            } else {
                const modal = new ModalBuilder()
                    .setCustomId('warn_reason_modal')
                    .setTitle('Warn User');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('warn_reason_input')
                    .setLabel('Reason for warning')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Enter the official reason for this warning...')
                    .setRequired(true)
                    .setMinLength(5)
                    .setMaxLength(500);

                const row = new ActionRowBuilder().addComponents(reasonInput);
                modal.addComponents(row);

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
     */
    async kick(interaction) {
        try {
            const service = this.getModerationService();
            if (!service) {
                await this.sendError(interaction, 'Moderation service is currently unavailable');
                return;
            }

            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);

            if (!member) {
                await this.sendError(interaction, 'User not found in this server');
                return;
            }

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.WARNING,
                title: '⚠️ Confirm Kick Action',
                description: `Are you sure you want to kick **${user.tag}** from the server?`,
                fields: [
                    { name: 'Target User', value: `${user} (\`${user.id}\`)`, inline: true },
                    { name: 'Reason', value: `\`${reason}\``, inline: true }
                ],
                footerText: 'This action confirmation will expire in 30 seconds'
            });

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
            await ResponseHelper.send(interaction, { embeds: [embed], components: [row] });

            setTimeout(() => {
                const state = this.client.guildStates.get(interaction.guild.id);
                if (state && state.pendingKick && state.pendingKick[interaction.user.id]) {
                    delete state.pendingKick[interaction.user.id];
                    this.client.guildStates.set(interaction.guild.id, state);
                }
            }, 30000);
        } catch (error) {
            this.log(`Error in kick command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to process kick command');
        }
    }

    /**
     * Ban command handler
     */
    async ban(interaction) {
        try {
            const service = this.getModerationService();
            if (!service) {
                await this.sendError(interaction, 'Moderation service is currently unavailable');
                return;
            }

            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const deleteMessages = interaction.options.getInteger('delete_messages') || 0;

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.ERROR,
                title: '🔨 Confirm Server Ban',
                description: `Are you sure you want to ban **${user.tag}** from this server?`,
                fields: [
                    { name: 'Target User', value: `${user} (\`${user.id}\`)`, inline: true },
                    { name: 'Delete Message History', value: `\`${deleteMessages} days\``, inline: true },
                    { name: 'Reason', value: `\`${reason}\``, inline: false }
                ],
                footerText: 'This ban confirmation will expire in 30 seconds'
            });

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
            await ResponseHelper.send(interaction, { embeds: [embed], components: [row] });

            setTimeout(() => {
                const state = this.client.guildStates.get(interaction.guild.id);
                if (state && state.pendingBan && state.pendingBan[interaction.user.id]) {
                    delete state.pendingBan[interaction.user.id];
                    this.client.guildStates.set(interaction.guild.id, state);
                }
            }, 30000);
        } catch (error) {
            this.log(`Error in ban command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to process ban command');
        }
    }

    /**
     * Unban command handler
     */
    async unban(interaction) {
        try {
            const service = this.getModerationService();
            if (!service) {
                await this.sendError(interaction, 'Moderation service is currently unavailable');
                return;
            }

            const userId = interaction.options.getString('user_id');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            const result = await service.unbanMember(
                interaction.guild,
                userId,
                interaction.user,
                reason
            );

            if (!result.success) {
                await this.sendError(interaction, result.error || 'Failed to unban user');
                return;
            }

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.SUCCESS,
                title: '🔓 User Unbanned',
                description: `Successfully revoked ban for **${result.user?.tag || userId}** (\`${userId}\`).`,
                fields: [{ name: 'Reason', value: `\`${reason}\``, inline: false }]
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.log(`Error in unban command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to unban user');
        }
    }

    /**
     * Timeout command handler
     */
    async timeout(interaction) {
        try {
            const service = this.getModerationService();
            if (!service) {
                await this.sendError(interaction, 'Moderation service is currently unavailable');
                return;
            }

            const user = interaction.options.getUser('user');
            const duration = interaction.options.getInteger('duration');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);

            if (!member) {
                await this.sendError(interaction, 'User not found in this server');
                return;
            }

            const result = await service.timeoutMember(
                interaction.guild,
                member,
                interaction.user,
                duration,
                reason
            );

            if (!result.success) {
                await this.sendError(interaction, result.error || 'Failed to timeout user');
                return;
            }

            const embed = ResponseHelper.moderationCard({
                action: 'TIMEOUT',
                target: user,
                moderator: interaction.user,
                duration: `${duration} minutes`,
                reason,
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.log(`Error in timeout command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to timeout user');
        }
    }

    /**
     * Purge command handler
     */
    async purge(interaction) {
        try {
            const amount = interaction.options.getInteger('amount');

            if (amount < 1 || amount > 100) {
                await this.sendError(interaction, 'Purge amount must be between 1 and 100 messages.', true);
                return;
            }

            await interaction.deferReply({ ephemeral: true });
            const messages = await interaction.channel.bulkDelete(amount, true);

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.INFO,
                title: '🧹 Channel Messages Purged',
                description: `Successfully cleaned up **${messages.size} messages** from ${interaction.channel}.`
            });

            await ResponseHelper.send(interaction, embed, { ephemeral: true });
            this.log(`Purged ${messages.size} messages in channel ${interaction.channel.id}`, 'info');
        } catch (error) {
            this.log(`Error in purge command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to purge messages');
        }
    }

    /**
     * Warnings command handler
     */
    async warnings(interaction) {
        try {
            const service = this.getModerationService();
            if (!service) {
                await this.sendError(interaction, 'Moderation service is currently unavailable');
                return;
            }

            const user = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;

            const warnings = await service.getWarnings(user.id, guildId);

            if (!warnings || warnings.length === 0) {
                const embed = ResponseHelper.success(
                    'Clean Record',
                    `**${user.username}** has no active warnings in this server! 🎉`
                );
                await ResponseHelper.send(interaction, embed);
                return;
            }

            const warningLines = warnings.map((w, i) => {
                return `**#${i + 1} • Case ${w.id || 'N/A'}** — <t:${Math.floor(w.timestamp / 1000)}:R>\n> **Reason:** \`${w.reason}\`\n> **Moderator:** <@${w.moderator_id || w.moderatorId}>`;
            });

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.WARNING,
                author: { name: `Infraction History • ${user.username}`, iconURL: user.displayAvatarURL?.() || undefined },
                description: [
                    `Total Warnings: **${warnings.length}**`,
                    '',
                    ...warningLines
                ].join('\n\n'),
                footerText: 'Server Moderation History'
            });

            await ResponseHelper.send(interaction, embed);
        } catch (error) {
            this.log(`Error in warnings command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to fetch user warnings');
        }
    }
}

module.exports = ModerationController;
