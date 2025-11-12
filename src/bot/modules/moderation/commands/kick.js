const { BaseCommand } = require('../../../base/BaseCommand');
const { moderation: logger } = require('../../../services/logging.service');

/**
 * Kick command - Kick a member from the server
 */
class KickCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'kick',
      description: 'Kick a member from the server',
      category: 'Moderation',
      usage: '<user> [reason]',
      aliases: ['boot', 'remove'],
      cooldown: 5000,
      args: true,
      minArgs: 1,
      permissions: ['KickMembers'],
      botPermissions: ['KickMembers'],
      guildOnly: true
    });
  }

  async execute(message, args) {
    try {
      // Parse user mention/ID
      const userInput = args[0];
      const reason = args.slice(1).join(' ') || 'No reason provided';

      // Get member to kick
      const member = await this.getMember(message.guild, userInput);
      if (!member) {
        return message.reply(this.formatError('Could not find that member. Please mention a user or provide a valid user ID.'));
      }

      // Check if member is kickable
      if (!member.kickable) {
        return message.reply(this.formatError('I cannot kick this member. They may have higher permissions than me.'));
      }

      // Check if author can kick this member
      if (message.member.roles.highest.position <= member.roles.highest.position) {
        return message.reply(this.formatError('You cannot kick this member as they have equal or higher role than you.'));
      }

      // Confirm kick (optional, for important actions)
      const confirmEmbed = {
        color: 0xffa500,
        title: '⚠️ Confirm Kick',
        description: `Are you sure you want to kick ${member.user.tag}?`,
        fields: [
          {
            name: 'User',
            value: `${member.user.tag} (${member.user.id})`,
            inline: true
          },
          {
            name: 'Reason',
            value: reason,
            inline: true
          }
        ],
        footer: {
          text: 'React with ✅ to confirm or ❌ to cancel'
        },
        timestamp: new Date()
      };

      const confirmMessage = await message.reply({ embeds: [confirmEmbed] });
      await confirmMessage.react('✅');
      await confirmMessage.react('❌');

      // Wait for confirmation
      const filter = (reaction, user) => {
        return ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id;
      };

      try {
        const collected = await confirmMessage.awaitReactions({ filter, max: 1, time: 30000, errors: ['time'] });
        const reaction = collected.first();

        if (reaction.emoji.name === '❌') {
          await confirmMessage.edit({
            embeds: [{
              color: 0xff0000,
              title: '❌ Kick Cancelled',
              description: 'The kick operation has been cancelled.',
              timestamp: new Date()
            }]
          });
          return;
        }

        // Proceed with kick
        await this.performKick(message, member, reason);

      } catch (error) {
        await confirmMessage.edit({
          embeds: [{
            color: 0xffa500,
            title: '⏱️ Confirmation Timeout',
            description: 'Kick confirmation timed out. No action was taken.',
            timestamp: new Date()
          }]
        });
      }

    } catch (error) {
      logger.error('Error in kick command', { 
        error: error.message,
        user: message.author.tag,
        guild: message.guild.name
      });
      
      await message.reply(this.formatError('An error occurred while trying to kick the member.'));
    }
  }

  /**
   * Perform the kick operation
   * @param {Message} message - Command message
   * @param {GuildMember} member - Member to kick
   * @param {string} reason - Kick reason
   */
  async performKick(message, member, reason) {
    try {
      // Kick the member
      await member.kick(reason);

      // Create success embed
      const successEmbed = {
        color: 0x00ff00,
        title: '✅ Member Kicked',
        description: `${member.user.tag} has been kicked from the server.`,
        fields: [
          {
            name: 'User',
            value: `${member.user.tag} (${member.user.id})`,
            inline: true
          },
          {
            name: 'Reason',
            value: reason,
            inline: true
          },
          {
            name: 'Moderator',
            value: message.author.tag,
            inline: true
          }
        ],
        timestamp: new Date()
      };

      await message.channel.send({ embeds: [successEmbed] });

      // Log to database
      await this.logModerationAction(message.guild.id, 'kick', {
        targetId: member.user.id,
        targetTag: member.user.tag,
        moderatorId: message.author.id,
        moderatorTag: message.author.tag,
        reason: reason,
        timestamp: Date.now()
      });

      logger.info(`Member kicked: ${member.user.tag} from ${message.guild.name} by ${message.author.tag}`);

    } catch (error) {
      logger.error('Failed to kick member', { 
        error: error.message,
        member: member.user.tag,
        guild: message.guild.name
      });
      
      await message.channel.send(this.formatError('Failed to kick the member. Please check my permissions.'));
    }
  }

  /**
   * Get member from guild by mention or ID
   * @param {Guild} guild - Discord guild
   * @param {string} input - User mention or ID
   * @returns {GuildMember|null}
   */
  async getMember(guild, input) {
    // Try to get by mention
    const mentionMatch = input.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
      return guild.members.cache.get(mentionMatch[1]) || await guild.members.fetch(mentionMatch[1]).catch(() => null);
    }

    // Try to get by ID
    if (/^\d+$/.test(input)) {
      return guild.members.cache.get(input) || await guild.members.fetch(input).catch(() => null);
    }

    // Try to get by username
    return guild.members.cache.find(member => 
      member.user.username.toLowerCase() === input.toLowerCase() ||
      member.user.tag.toLowerCase() === input.toLowerCase()
    );
  }

  /**
   * Log moderation action to database
   * @param {string} guildId - Guild ID
   * @param {string} action - Action type
   * @param {Object} data - Action data
   */
  async logModerationAction(guildId, action, data) {
    try {
      if (!this.client.database) return;

      await this.client.database.query(
        `INSERT INTO logs (guild_id, event_type, data) VALUES (?, ?, ?)`,
        [
          guildId,
          `moderation_${action}`,
          JSON.stringify(data)
        ]
      );

    } catch (error) {
      logger.error('Failed to log moderation action', { error: error.message });
    }
  }
}

module.exports = KickCommand;