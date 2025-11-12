const { BaseCommand } = require('../../base/BaseCommand');
const CONFIG = require('../../config');
const { getLevelProgress } = require('../../utils/functions');

module.exports = class RankCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'rank',
      description: 'Menampilkan level dan XP pengguna.',
      category: 'leveling',
      usage: 'rank [@user]',
      cooldown: 2000
    });
  }

  async execute(message) {
    const db = this.client.database;
    const target = message.mentions.users.first() || message.author;
    const guildId = message.guild.id;
    const userId = target.id;
    const row = await db.get('SELECT l.xp, l.level FROM leveling l JOIN members m ON l.member_id = m.id WHERE m.user_id = ? AND m.guild_id = ?', [userId, guildId]);
    const xp = row?.xp || 0;
    const progress = getLevelProgress(xp, CONFIG.LEVELING.LEVEL_UP_BASE, CONFIG.LEVELING.LEVEL_UP_MULTIPLIER);
    await message.reply({ embeds: [{ color: 0x00bcd4, title: `Level ${target.tag}`, fields: [{ name: 'Level', value: `${row?.level || progress.level}`, inline: true }, { name: 'XP', value: `${xp}`, inline: true }, { name: 'Progress', value: `${progress.percentage}%`, inline: true }], timestamp: new Date() }] });
  }
};

