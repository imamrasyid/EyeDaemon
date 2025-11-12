const { BaseCommand } = require('../../base/BaseCommand');

module.exports = class LvLeaderboardCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'lvlb',
      description: 'Menampilkan papan peringkat leveling.',
      category: 'leveling',
      usage: 'lvlb',
      cooldown: 5000
    });
  }

  async execute(message) {
    const db = this.client.database;
    const guildId = message.guild.id;
    const rows = await db.all(
      'SELECT m.user_id, l.xp, l.level FROM leveling l JOIN members m ON l.member_id = m.id WHERE m.guild_id = ? ORDER BY l.xp DESC LIMIT 10',
      [guildId]
    );
    if (!rows || rows.length === 0) return message.reply(this.formatError('Belum ada data.'));
    const lines = rows.map((r, i) => `${i + 1}. <@${r.user_id}> — Lv ${r.level} (${r.xp} XP)`).join('\n');
    await message.reply({ embeds: [{ color: 0x8e44ad, title: '🧠 Level Leaderboard', description: lines, timestamp: new Date() }] });
  }
};

