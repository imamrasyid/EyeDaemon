const { BaseCommand } = require('../../base/BaseCommand');
const { PermissionFlagsBits } = require('discord.js');

module.exports = class WarnCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'warn',
      description: 'Memberikan peringatan kepada pengguna.',
      category: 'moderation',
      usage: 'warn <@user> <reason>',
      args: true,
      minArgs: 2,
      permissions: [PermissionFlagsBits.ModerateMembers],
      cooldown: 2000
    });
  }

  async execute(message, args) {
    const target = message.mentions.members.first();
    const reason = args.slice(1).join(' ');
    if (!target) return message.reply(this.formatError('Pengguna tidak valid.'));
    const db = this.client.database;
    const memberIdRow = await db.get('SELECT id FROM members WHERE user_id = ? AND guild_id = ?', [target.id, message.guild.id]);
    if (!memberIdRow) return message.reply(this.formatError('Pengguna belum terdaftar.'));
    await db.query('INSERT INTO warnings (id, member_id, reason, warned_by) VALUES (?, ?, ?, ?)', [Date.now().toString(), memberIdRow.id, reason, message.author.id]);
    await message.reply(this.formatSuccess(`Memberikan peringatan kepada ${target.user.tag}: ${reason}`));
  }
};

