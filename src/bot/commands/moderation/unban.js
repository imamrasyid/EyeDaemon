const { BaseCommand } = require('../../base/BaseCommand');
const { PermissionFlagsBits } = require('discord.js');

module.exports = class UnbanCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'unban',
      description: 'Membuka ban pada pengguna.',
      category: 'moderation',
      usage: 'unban <userId>',
      args: true,
      minArgs: 1,
      permissions: [PermissionFlagsBits.BanMembers],
      cooldown: 2000
    });
  }

  async execute(message, args) {
    const userId = args[0];
    await message.guild.bans.remove(userId).catch(() => {});
    await message.reply(this.formatSuccess(`Unban pengguna ${userId}.`));
  }
};

