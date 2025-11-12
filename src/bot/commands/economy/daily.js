const { BaseCommand } = require('../../base/BaseCommand');
const CONFIG = require('../../config');
const { generateRandomString } = require('../../utils/functions');

module.exports = class DailyCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'daily',
      description: 'Mengambil hadiah harian.',
      category: 'economy',
      usage: 'daily',
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
      await db.query('INSERT INTO economy (member_id, balance, bank_balance, daily_streak) VALUES (?, ?, ?, ?)', [memberId, CONFIG.ECONOMY.STARTING_BALANCE, 0, 0]);
    }
    const row = await db.get('SELECT balance, daily_streak, last_daily FROM economy WHERE member_id = ?', [memberId]);
    const now = Date.now();
    const last = row?.last_daily ? new Date(row.last_daily).getTime() : 0;
    const diff = now - last;
    if (last && diff < 24 * 60 * 60 * 1000) {
      const remain = 24 * 60 * 60 * 1000 - diff;
      const hours = Math.floor(remain / 3600000);
      const mins = Math.floor((remain % 3600000) / 60000);
      return message.reply({ embeds: [{ color: 0xffa500, title: '⏰ Daily belum tersedia', description: `Coba lagi dalam ${hours}h ${mins}m`, timestamp: new Date() }] });
    }
    const reward = CONFIG.ECONOMY.DAILY_REWARD;
    const streak = (row?.daily_streak || 0) + 1;
    await db.query('UPDATE economy SET balance = balance + ?, daily_streak = ?, last_daily = CURRENT_TIMESTAMP WHERE member_id = ?', [reward, streak, memberId]);
    await message.reply({ embeds: [{ color: 0x00ff00, title: '✅ Daily', description: `Kamu menerima ${reward} koin. Streak: ${streak}`, timestamp: new Date() }] });
  }
};

