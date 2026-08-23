/**
 * TicketController
 * 
 * Handles all ticket-related commands
 * Manages support tickets, categories, and staff assignment with ResponseHelper UI.
 */

const Controller = require('../../system/core/Controller');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const ResponseHelper = require('../../system/helpers/ResponseHelper');

class TicketController extends Controller {
    /**
     * Create a new TicketController instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client);

        // Load models
        this.ticketModel = this.load.model('TicketModel');
    }

    /**
     * Ticket command handler
     * Creates a new support ticket
     */
    async ticket(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const category = interaction.options.getString('category') || 'general';
            const description = interaction.options.getString('description') || 'No description provided';
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;

            // Check if user already has an open ticket
            const existingTicket = await this.ticketModel.getUserOpenTicket(userId, guildId);
            if (existingTicket) {
                const embed = ResponseHelper.warning(
                    'Active Ticket Exists',
                    `You already have an active open ticket in <#${existingTicket.channel_id}>. Please resolve or close it before opening a new one.`
                );
                await ResponseHelper.send(interaction, embed, { ephemeral: true });
                return;
            }

            // Create ticket channel
            const ticketNumber = await this.ticketModel.getNextTicketNumber(guildId);
            const channelName = `ticket-${ticketNumber}`;

            const channel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                    {
                        id: this.client.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                ],
            });

            // Save ticket to database
            await this.ticketModel.createTicket(guildId, userId, channel.id, category, description, ticketNumber);

            // Send initial ticket message in the newly created channel
            const ticketWelcomeEmbed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.TICKET,
                title: `🎫 Support Ticket #${ticketNumber}`,
                description: [
                    `Hello ${interaction.user}, welcome to your private support channel!`,
                    'Staff has been notified and will assist you shortly.',
                    '',
                    `**Category:** \`${category.toUpperCase()}\``,
                    `**Description:** \`\`\`${description}\`\`\``,
                    '',
                    ResponseHelper.subtext('Use `/close` when your inquiry has been resolved.')
                ].join('\n'),
            });

            await channel.send({ content: `${interaction.user}`, embeds: [ticketWelcomeEmbed] });

            const successEmbed = ResponseHelper.success(
                'Ticket Created',
                `Your support ticket has been opened successfully: ${channel}`
            );
            await ResponseHelper.send(interaction, successEmbed, { ephemeral: true });

            this.log(`Ticket #${ticketNumber} created by ${userId}`, 'info');
        } catch (error) {
            this.log(`Error in ticket command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to create ticket channel');
        }
    }

    /**
     * Close command handler
     * Closes a ticket
     */
    async close(interaction) {
        try {
            const guildId = interaction.guild.id;
            const channelId = interaction.channel.id;

            const ticket = await this.ticketModel.getTicketByChannel(channelId, guildId);
            if (!ticket) {
                await this.sendError(interaction, 'This command can only be used inside an active ticket channel.');
                return;
            }

            if (ticket.status === 'closed') {
                await this.sendError(interaction, 'This ticket is already closed.');
                return;
            }

            await this.ticketModel.closeTicket(ticket.id, interaction.user.id);

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.ERROR,
                title: '🔒 Ticket Closed',
                description: `Ticket **#${ticket.ticket_number}** has been closed by ${interaction.user}.\n\n*This channel will be deleted in 5 seconds...*`
            });

            await ResponseHelper.send(interaction, embed);

            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (error) {
                    this.log(`Failed to delete ticket channel: ${error.message}`, 'error');
                }
            }, 5000);

            this.log(`Ticket #${ticket.ticket_number} closed by ${interaction.user.id}`, 'info');
        } catch (error) {
            this.log(`Error in close command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to close ticket');
        }
    }

    /**
     * Claim command handler
     * Claims a ticket for a staff member
     */
    async claim(interaction) {
        try {
            const guildId = interaction.guild.id;
            const channelId = interaction.channel.id;
            const member = interaction.member;

            const hasPermission = member.permissions.has('ManageChannels') || member.permissions.has('Administrator');
            if (!hasPermission) {
                await this.sendError(interaction, 'You need **Manage Channels** permission to claim tickets.', true);
                return;
            }

            const ticket = await this.ticketModel.getTicketByChannel(channelId, guildId);
            if (!ticket) {
                await this.sendError(interaction, 'This is not an active ticket channel.');
                return;
            }

            if (ticket.claimed_by) {
                await this.sendError(interaction, `This ticket is already claimed by <@${ticket.claimed_by}>.`);
                return;
            }

            await this.ticketModel.claimTicket(ticket.id, interaction.user.id);

            const embed = ResponseHelper.success(
                'Ticket Claimed',
                `Staff member ${interaction.user} has officially claimed **Ticket #${ticket.ticket_number}** and is handling your inquiry.`
            );

            await ResponseHelper.send(interaction, embed);
            this.log(`Ticket #${ticket.ticket_number} claimed by ${interaction.user.id}`, 'info');
        } catch (error) {
            this.log(`Error in claim command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to claim ticket');
        }
    }

    /**
     * Unclaim command handler
     * Unclaims a ticket
     */
    async unclaim(interaction) {
        try {
            const guildId = interaction.guild.id;
            const channelId = interaction.channel.id;

            const ticket = await this.ticketModel.getTicketByChannel(channelId, guildId);
            if (!ticket) {
                await this.sendError(interaction, 'This is not an active ticket channel.');
                return;
            }

            if (!ticket.claimed_by) {
                await this.sendError(interaction, 'This ticket is not currently claimed.');
                return;
            }

            await this.ticketModel.unclaimTicket(ticket.id);

            const embed = ResponseHelper.info(
                'Ticket Unclaimed',
                `**Ticket #${ticket.ticket_number}** is now open for any staff member to assist.`
            );

            await ResponseHelper.send(interaction, embed);
            this.log(`Ticket #${ticket.ticket_number} unclaimed`, 'info');
        } catch (error) {
            this.log(`Error in unclaim command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to unclaim ticket');
        }
    }

    /**
     * Add command handler
     * Adds a user to a ticket
     */
    async add(interaction) {
        try {
            const user = interaction.options.getUser('user');
            const guildId = interaction.guild.id;
            const channelId = interaction.channel.id;

            const ticket = await this.ticketModel.getTicketByChannel(channelId, guildId);
            if (!ticket) {
                await this.sendError(interaction, 'This is not an active ticket channel.');
                return;
            }

            await interaction.channel.permissionOverwrites.create(user.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
            });

            const embed = ResponseHelper.success(
                'Member Added',
                `Successfully added ${user} to **Ticket #${ticket.ticket_number}**.`
            );

            await ResponseHelper.send(interaction, embed);
            this.log(`User ${user.id} added to ticket #${ticket.ticket_number}`, 'info');
        } catch (error) {
            this.log(`Error in add command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to add user to ticket');
        }
    }

    /**
     * Remove command handler
     * Removes a user from a ticket
     */
    async remove(interaction) {
        try {
            const user = interaction.options.getUser('user');
            const guildId = interaction.guild.id;
            const channelId = interaction.channel.id;

            const ticket = await this.ticketModel.getTicketByChannel(channelId, guildId);
            if (!ticket) {
                await this.sendError(interaction, 'This is not an active ticket channel.');
                return;
            }

            await interaction.channel.permissionOverwrites.delete(user.id);

            const embed = ResponseHelper.info(
                'Member Removed',
                `Successfully removed ${user} from **Ticket #${ticket.ticket_number}**.`
            );

            await ResponseHelper.send(interaction, embed);
            this.log(`User ${user.id} removed from ticket #${ticket.ticket_number}`, 'info');
        } catch (error) {
            this.log(`Error in remove command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to remove user from ticket');
        }
    }

    /**
     * Tickets command handler
     * Lists all tickets
     */
    async tickets(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const guildId = interaction.guild.id;
            const status = interaction.options.getString('status') || 'open';

            const tickets = await this.ticketModel.getTickets(guildId, status);

            if (!tickets || tickets.length === 0) {
                const embed = ResponseHelper.info(
                    'Ticket Registry',
                    `No **${status}** tickets found for this server.`
                );
                await ResponseHelper.send(interaction, embed, { ephemeral: true });
                return;
            }

            const ticketLines = tickets.map(t => {
                const claimText = t.claimed_by ? ` • Claimed: <@${t.claimed_by}>` : '';
                return `**#${t.ticket_number}** • <#${t.channel_id}> • User: <@${t.user_id}> \`[${t.category || 'general'}]\`${claimText}`;
            });

            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.TICKET,
                title: `🎫 Server Tickets • ${status.toUpperCase()}`,
                description: ticketLines.join('\n'),
                footerText: `Total ${status.toUpperCase()} Tickets: ${tickets.length}`
            });

            await ResponseHelper.send(interaction, embed, { ephemeral: true });
        } catch (error) {
            this.log(`Error in tickets command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to list tickets');
        }
    }
}

module.exports = TicketController;
