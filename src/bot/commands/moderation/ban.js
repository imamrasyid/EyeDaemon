const { BaseCommand } = require('../../base/BaseCommand');
const { PermissionFlagsBits } = require('discord.js');

module.exports = class BanCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'ban',
      description: 'Memban pengguna dari server.',
      category: 'moderation',
      usage: 'ban <@user> [alasan]',
      args: true,
      minArgs: 1,
      permissions: [PermissionFlagsBits.BanMembers],
      cooldown: 2000
    });
  }

  async execute(message, args) {
    const target = message.mentions.members.first();
    const reason = args.slice(1).join(' ') || 'No reason';
    if (!target) return message.reply(this.formatError('Pengguna tidak valid.'));
    await target.ban({ reason });
    await message.reply(this.formatSuccess(`Ban ${target.user.tag}.`));
  }
};

