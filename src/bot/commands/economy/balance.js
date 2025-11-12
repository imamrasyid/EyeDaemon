const { BaseCommand } = require('../../base/BaseCommand');
const { generateRandomString } = require('../../utils/functions');

module.exports = class BalanceCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'balance',
      description: 'Menampilkan saldo uang dan bank.',
      category: 'economy',
      usage: 'balance [@user]',
      aliases: ['bal'],
      cooldown: 2000
    });
  }

  async execute(message, args) {
    const target = message.mentions.users.first() || message.author;
    const guildId = message.guild.id;
    const userId = target.id;
    const db = this.client.database;
    const member = await db.get('SELECT id FROM members WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    let memberId = member?.id;
    if (!memberId) {
      memberId = generateRandomString(16);
      await db.query('INSERT INTO members (id, guild_id, user_id) VALUES (?, ?, ?)', [memberId, guildId, userId]);
      await db.query('INSERT INTO economy (member_id, balance, bank_balance) VALUES (?, ?, ?)', [memberId, 0, 0]);
    }
    const row = await db.get('SELECT balance, bank_balance FROM economy WHERE member_id = ?', [memberId]);
    const bal = row?.balance || 0;
    const bank = row?.bank_balance || 0;
    await message.reply({ embeds: [{ color: 0x00b894, title: `Saldo ${target.tag}`, fields: [{ name: 'Dompet', value: `${bal}`, inline: true }, { name: 'Bank', value: `${bank}`, inline: true }], timestamp: new Date() }] });
  }
};

