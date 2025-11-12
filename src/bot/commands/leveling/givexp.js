const { BaseCommand } = require('../../base/BaseCommand');
const { PermissionFlagsBits } = require('discord.js');

module.exports = class GiveXPCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'givexp',
      description: 'Memberikan XP ke pengguna.',
      category: 'leveling',
      usage: 'givexp <@user> <amount>',
      args: true,
      minArgs: 2,
      permissions: [PermissionFlagsBits.ManageGuild],
      cooldown: 2000
    });
  }

  async execute(message, args) {
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || !Number.isFinite(amount) || amount <= 0) return message.reply(this.formatError('Format: givexp <@user> <amount>'));
    const module = this.client.modules.get('Leveling');
    if (!module) return message.reply(this.formatError('Modul Leveling tidak tersedia.'));
    const info = await module.addXP(target.id, message.guild.id, amount);
    await message.reply(this.formatSuccess(`Menambahkan ${amount} XP ke ${target.tag}. Level: ${info?.newLevel ?? '-'}`));
  }
};

