const { BaseCommand } = require('../../base/BaseCommand');

module.exports = class FilterCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'filter',
            description: 'Menerapkan efek audio preset ke pemutar saat ini.',
            category: 'music',
            usage: 'filter <preset>',
            aliases: ['fx'],
            cooldown: 2000
        });
    }

    async execute(message, args) {
        try {
            const preset = args[0];
            if (!preset) return message.reply("❓ Mohon berikan nama preset filter. Contoh: `!filter bassboost`");

            const { setFilter } = require("../../services/player");
            await setFilter(message, preset);
            await message.reply(`🎚️ Filter **${preset}** diterapkan.`);
        } catch (err) {
            console.error("filter() error:", err);
            await message.reply("❌ Terjadi kesalahan saat menerapkan filter.");
        }
    }
};
