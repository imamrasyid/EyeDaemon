const { BaseCommand } = require('../../base/BaseCommand');
const { PermissionFlagsBits } = require('discord.js');

module.exports = class KickCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'kick',
      description: 'Mengeluarkan pengguna dari server.',
      category: 'moderation',
      usage: 'kick <@user> [alasan]',
      args: true,
      minArgs: 1,
      permissions: [PermissionFlagsBits.KickMembers],
      cooldown: 2000
    });
  }

  async execute(message, args) {
    const target = message.mentions.members.first();
    const reason = args.slice(1).join(' ') || 'No reason';
    if (!target) return message.reply(this.formatError('Pengguna tidak valid.'));
    await target.kick(reason);
    await message.reply(this.formatSuccess(`Kick ${target.user.tag}.`));
  }
};

