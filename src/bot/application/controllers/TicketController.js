/**
 * TicketController
 * 
 * Handles all ticket-related commands
 * Manages support tickets, categories, and staff assignment
 */

const Controller = require('../../system/core/Controller');
const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { deferEphemeral } = require('../../system/helpers/interaction_helper');

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
     * @param {Object} interaction - Discord interaction
     */
    async ticket(interaction) {
        try {
            await deferEphemeral(interaction);

            const category = interaction.options.getString('category') || 'general';
            const description = interaction.options.getString('description');
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;

            // Check if user already has an open ticket
            const existingTicket = await this.ticketModel.getUserOpenTicket(userId, guildId);
            if (existingTicket) {
                await interaction.editReply({ content: `❌ You already have an open ticket: <#${existingTicket.channel_id}>` });
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

            // Send ticket message
            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(`🎫 Ticket #${ticketNumber}`)
                .setDescription(description || 'No description provided')
                .addFields(
                    { name: 'Category', value: category, inline: true },
                    { name: 'Created By', value: `${interaction.user}`, inline: true },
                    { name: 'Status', value: 'Open', inline: true }
                )
                .setTimestamp();

            await channel.send({ content: `${interaction.user}`, embeds: [embed] });

            await interaction.editReply({ content: `✅ Ticket created: ${channel}` });
            this.log(`Ticket #${ticketNumber} created by ${userId}`, 'info');
        } catch (error) {
            this.log(`Error in ticket command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to create ticket');
        }
    }

    /**
     * Close command handler
     * Closes a ticket
     * @param {Object} interaction - Discord interaction
     */
    async close(interaction) {
        try {
            const guildId = interaction.guild.id;
            const channelId = interaction.channel.id;

            // Check if this is a ticket channel
            const ticket = await this.ticketModel.getTicketByChannel(channelId, guildId);
            if (!ticket) {
                await interaction.reply({ content: '❌ This is not a ticket channel' });
                return;
            }

            if (ticket.status === 'closed') {
                await interaction.reply({ content: '❌ This ticket is already closed' });
                return;
            }

            // Close the ticket
            await this.ticketModel.closeTicket(ticket.id, interaction.user.id);

            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('🔒 Ticket Closed')
                .setDescription(`Ticket #${ticket.ticket_number} has been closed by ${interaction.user}`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // Delete channel after 5 seconds
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
     * @param {Object} interaction - Discord interaction
     */
    async claim(interaction) {
        try {
            const guildId = interaction.guild.id;
            const channelId = interaction.channel.id;

            // Check if this is a ticket channel
            const ticket = await this.ticketModel.getTicketByChannel(channelId, guildId);
            if (!ticket) {
                await interaction.reply({ content: '❌ This is not a ticket channel' });
                return;
            }

            if (ticket.claimed_by) {
                await interaction.reply({ content: `❌ This ticket is already claimed by <@${ticket.claimed_by}>` });
                return;
            }

            // Claim the ticket
            await this.ticketModel.claimTicket(ticket.id, interaction.user.id);

            await interaction.reply(`✅ ${interaction.user} has claimed this ticket`);
            this.log(`Ticket #${ticket.ticket_number} claimed by ${interaction.user.id}`, 'info');
        } catch (error) {
            this.log(`Error in claim command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to claim ticket');
        }
    }

    /**
     * Unclaim command handler
     * Unclaims a ticket
     * @param {Object} interaction - Discord interaction
     */
    async unclaim(interaction) {
        try {
            const guildId = interaction.guild.id;
            const channelId = interaction.channel.id;

            // Check if this is a ticket channel
            const ticket = await this.ticketModel.getTicketByChannel(channelId, guildId);
            if (!ticket) {
                await interaction.reply({ content: '❌ This is not a ticket channel' });
                return;
            }

            if (!ticket.claimed_by) {
                await interaction.reply({ content: '❌ This ticket is not claimed' });
                return;
            }

            // Unclaim the ticket
            await this.ticketModel.unclaimTicket(ticket.id);

            await interaction.reply(`✅ Ticket has been unclaimed`);
            this.log(`Ticket #${ticket.ticket_number} unclaimed`, 'info');
        } catch (error) {
            this.log(`Error in unclaim command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to unclaim ticket');
        }
    }

    /**
     * Add command handler
     * Adds a user to a ticket
     * @param {Object} interaction - Discord interaction
     */
    async add(interaction) {
        try {
            const user = interaction.options.getUser('user');
            const guildId = interaction.guild.id;
            const channelId = interaction.channel.id;

            // Check if this is a ticket channel
            const ticket = await this.ticketModel.getTicketByChannel(channelId, guildId);
            if (!ticket) {
                await interaction.reply({ content: '❌ This is not a ticket channel' });
                return;
            }

            // Add user to channel
            await interaction.channel.permissionOverwrites.create(user.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
            });

            await interaction.reply(`✅ Added ${user} to the ticket`);
            this.log(`User ${user.id} added to ticket #${ticket.ticket_number}`, 'info');
        } catch (error) {
            this.log(`Error in add command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to add user to ticket');
        }
    }

    /**
     * Remove command handler
     * Removes a user from a ticket
     * @param {Object} interaction - Discord interaction
     */
    async remove(interaction) {
        try {
            const user = interaction.options.getUser('user');
            const guildId = interaction.guild.id;
            const channelId = interaction.channel.id;

            // Check if this is a ticket channel
            const ticket = await this.ticketModel.getTicketByChannel(channelId, guildId);
            if (!ticket) {
                await interaction.reply({ content: '❌ This is not a ticket channel' });
                return;
            }

            // Remove user from channel
            await interaction.channel.permissionOverwrites.delete(user.id);

            await interaction.reply(`✅ Removed ${user} from the ticket`);
            this.log(`User ${user.id} removed from ticket #${ticket.ticket_number}`, 'info');
        } catch (error) {
            this.log(`Error in remove command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to remove user from ticket');
        }
    }

    /**
     * Tickets command handler
     * Lists all tickets
     * @param {Object} interaction - Discord interaction
     */
    async tickets(interaction) {
        try {
            await deferEphemeral(interaction);

            const guildId = interaction.guild.id;
            const status = interaction.options.getString('status') || 'open';

            const tickets = await this.ticketModel.getTickets(guildId, status);

            if (tickets.length === 0) {
                await interaction.editReply({ content: `No ${status} tickets found` });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(`🎫 ${status.charAt(0).toUpperCase() + status.slice(1)} Tickets`)
                .setDescription(tickets.map(t => `**#${t.ticket_number}** - <#${t.channel_id}> - <@${t.user_id}>`).join('\n'))
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            this.log(`Error in tickets command: ${error.message}`, 'error');
            await this.sendError(interaction, 'Failed to list tickets');
        }
    }
}

module.exports = TicketController;
