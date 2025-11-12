const { BaseCommand } = require('../../base/BaseCommand');
const CONFIG = require('../../config');
const { generateRandomString, generateRandomNumber } = require('../../utils/functions');

module.exports = class WorkCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'work',
      description: 'Bekerja untuk mendapat koin acak.',
      category: 'economy',
      usage: 'work',
      cooldown: 5000
    });
  }

  async execute(message) {
    const db = this.client.database;
    const guildId = message.guild.id;
    const userId = message.author.id;
    let member = await db.get('SELECT id FROM members WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    let memberId = member?.id;
    if (!memberId) {
      memberId = generateRandomString(16);
      await db.query('INSERT INTO members (id, guild_id, user_id) VALUES (?, ?, ?)', [memberId, guildId, userId]);
      await db.query('INSERT INTO economy (member_id, balance, bank_balance) VALUES (?, ?, ?)', [memberId, CONFIG.ECONOMY.STARTING_BALANCE, 0]);
    }
    const amount = generateRandomNumber(CONFIG.ECONOMY.WORK_REWARD_MIN, CONFIG.ECONOMY.WORK_REWARD_MAX);
    await db.query('UPDATE economy SET balance = balance + ? WHERE member_id = ?', [amount, memberId]);
    await message.reply({ embeds: [{ color: 0x00b894, title: '💼 Work', description: `Kamu bekerja dan mendapat ${amount} koin.`, timestamp: new Date() }] });
  }
};

