'use strict';

/**
 * ResponseHelper - Centralized Design System & Message Templating Engine
 * 
 * Provides unified, professional, interactive, and modern Discord responses
 * across all EyeDaemon controllers, services, and interactions.
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    MessageFlags
} = require('discord.js');

// ── 1. Semantic Color Tokens ───────────────────────────────────────────────
const THEMES = {
    BRAND: 0x5865F2,      // Blurple (General info, bot presence, brand)
    SUCCESS: 0x22C55E,    // Emerald Green (Confirmations, level up, win)
    ERROR: 0xEF4444,      // Coral Red (Errors, rejections, loss, bans)
    WARNING: 0xF59E0B,    // Amber (Warnings, caution, timeouts)
    INFO: 0x3B82F6,       // Sky Blue (Neutral stats, guides)
    MUSIC: 0x8B5CF6,      // Cyberpunk Purple (Now playing, queue, audio)
    ECONOMY: 0xF59E0B,    // Gold Amber (Currency, shop, blackjack)
    LEVELING: 0x10B981,   // Mint Emerald (Rank, XP, leaderboards)
    MODERATION: 0xE11D48, // Ruby Crimson (Sanctions, kick, ban, warn)
    TICKET: 0x06B6D4,     // Electric Cyan (Support tickets, panels)
    ADMIN: 0x6366F1,      // Deep Indigo (Configs, audit, system)
    DARK: 0x1E293B,       // Slate Navy (Dark neutral cards)
};

// ── 2. Standard Emoji Badges ───────────────────────────────────────────────
const EMOJIS = {
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    SPARKLES: '✨',
    DOT: '•',
    ARROW: '➜',
    MUSIC: '🎵',
    PLAYING: '▶️',
    PAUSED: '⏸️',
    STOPPED: '⏹️',
    SKIP: '⏭️',
    LOOP: '🔁',
    VOLUME_HIGH: '🔊',
    VOLUME_LOW: '🔉',
    QUEUE: '📜',
    EQUALIZER: '🎚️',
    DISC: '💿',
    COIN: '🪙',
    BANK: '🏦',
    WALLET: '👛',
    WORK: '💼',
    SHOP: '🛍️',
    STREAK: '🔥',
    TROPHY: '🏆',
    RANK: '🎖️',
    XP: '⭐',
    LEVEL: '⚡',
    MEDAL_1: '🥇',
    MEDAL_2: '🥈',
    MEDAL_3: '🥉',
    SHIELD: '🛡️',
    WARN: '⚠️',
    MUTE: '🔇',
    KICK: '👢',
    BAN: '🔨',
    PURGE: '🧹',
    REASON: '📋',
    TICKET: '🎫',
    LOCK: '🔒',
    GEAR: '⚙️',
    PERFORMANCE: '📈',
    PING: '📡',
    MEMORY: '💾',
    CPU: '⚡',
};

// ── 3. Visual Utilities & Formatters ───────────────────────────────────────

/**
 * Generate a visual progress bar
 * @param {number} current - Current value
 * @param {number} total - Maximum value
 * @param {number} [length=10] - Number of bar segments
 * @param {string} [fill='▰'] - Character for filled segments
 * @param {string} [empty='▱'] - Character for empty segments
 * @returns {string} Formatted bar with percentage, e.g. `▰▰▰▰▰▱▱▱▱▱ 50%`
 */
function progressBar(current, total, length = 10, fill = '▰', empty = '▱') {
    if (total <= 0) total = 1;
    const progress = Math.min(Math.max(current / total, 0), 1);
    const filledCount = Math.round(progress * length);
    const emptyCount = length - filledCount;
    const bar = fill.repeat(filledCount) + empty.repeat(emptyCount);
    const percent = Math.round(progress * 100);
    return `${bar} \`${percent}%\``;
}

/**
 * Format duration in seconds to mm:ss or hh:mm:ss
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const totalSecs = Math.floor(seconds);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format dynamic Discord timestamp
 * @param {number|Date} dateOrTimestamp - Unix timestamp (seconds) or Date object
 * @param {string} [style='R'] - 't', 'T', 'd', 'D', 'f', 'F', 'R'
 * @returns {string}
 */
function formatTimestamp(dateOrTimestamp, style = 'R') {
    let unix = dateOrTimestamp;
    if (dateOrTimestamp instanceof Date) {
        unix = Math.floor(dateOrTimestamp.getTime() / 1000);
    } else if (typeof dateOrTimestamp === 'number' && dateOrTimestamp > 10000000000) {
        unix = Math.floor(dateOrTimestamp / 1000);
    }
    return `<t:${unix}:${style}>`;
}

/**
 * Format number with thousand separators
 * @param {number} num
 * @returns {string}
 */
function formatNumber(num) {
    return Number(num || 0).toLocaleString('en-US');
}

/**
 * Format currency amount with badge
 * @param {number} amount
 * @param {string} [currency='🪙']
 * @returns {string}
 */
function formatMoney(amount, currency = EMOJIS.COIN) {
    return `**${formatNumber(amount)}** ${currency}`;
}

/**
 * Wrap text as Discord modern subtext
 * @param {string} text
 * @returns {string}
 */
function subtext(text) {
    return `-# ${text}`;
}

// ── 4. Base Embed Generator ───────────────────────────────────────────────

/**
 * Create a standardized, modern rich embed
 * @param {Object} options
 * @returns {EmbedBuilder}
 */
function createEmbed(options = {}) {
    const embed = new EmbedBuilder();

    embed.setColor(options.color !== undefined ? options.color : THEMES.BRAND);

    if (options.title) {
        embed.setTitle(options.title);
    }

    if (options.url) {
        embed.setURL(options.url);
    }

    if (options.description) {
        embed.setDescription(options.description);
    }

    if (options.author) {
        if (typeof options.author === 'string') {
            embed.setAuthor({ name: options.author });
        } else {
            embed.setAuthor(options.author);
        }
    }

    if (options.thumbnail) {
        embed.setThumbnail(options.thumbnail);
    }

    if (options.image) {
        embed.setImage(options.image);
    }

    if (Array.isArray(options.fields) && options.fields.length > 0) {
        embed.addFields(options.fields);
    }

    const defaultFooterText = options.footerText || 'EyeDaemon Unified • Discord Bot';
    embed.setFooter({
        text: defaultFooterText,
        iconURL: options.footerIcon || undefined,
    });

    if (options.timestamp !== false) {
        embed.setTimestamp(options.timestamp instanceof Date ? options.timestamp : new Date());
    }

    return embed;
}

// ── 5. Standard Status Embeds ──────────────────────────────────────────────

function success(title, description, options = {}) {
    return createEmbed({
        color: THEMES.SUCCESS,
        title: `${EMOJIS.SUCCESS} ${title}`,
        description,
        ...options,
    });
}

function error(title, description, options = {}) {
    return createEmbed({
        color: THEMES.ERROR,
        title: `${EMOJIS.ERROR} ${title}`,
        description,
        ...options,
    });
}

function warning(title, description, options = {}) {
    return createEmbed({
        color: THEMES.WARNING,
        title: `${EMOJIS.WARNING} ${title}`,
        description,
        ...options,
    });
}

function info(title, description, options = {}) {
    return createEmbed({
        color: THEMES.INFO,
        title: `${EMOJIS.INFO} ${title}`,
        description,
        ...options,
    });
}

// ── 6. Domain-Specific Card Builders ───────────────────────────────────────

/**
 * Music Now Playing Card
 */
function nowPlayingCard(data = {}) {
    const { track, queue = {}, position = 0, isPaused = false, loopMode = 'off', volume = 80, filter = 'none' } = data;
    const title = track?.title || 'Unknown Track';
    const artist = track?.author || track?.uploader || 'Unknown Artist';
    const url = track?.url || null;
    const thumbnail = track?.thumbnail || null;
    const duration = track?.duration || 0;

    const currentFormatted = formatDuration(position);
    const durationFormatted = formatDuration(duration);
    const bar = progressBar(position, duration, 12, '▰', '▱');

    const statusBadge = isPaused ? '`⏸️ PAUSED`' : '`▶️ PLAYING`';
    const loopBadge = loopMode !== 'off' ? `\`🔁 ${loopMode.toUpperCase()}\`` : '`🔁 OFF`';
    const volBadge = `\`🔊 ${volume}%\``;
    const filterBadge = filter !== 'none' ? `\`🎚️ ${filter}\`` : null;

    const badges = [statusBadge, loopBadge, volBadge, filterBadge].filter(Boolean).join(' ');

    const description = [
        `### [${title}](${url || 'https://discord.com'})`,
        `**Artist / Channel:** \`${artist}\``,
        '',
        `${bar}`,
        `\`${currentFormatted}\` / \`${durationFormatted}\``,
        '',
        `**Status:** ${badges}`,
        track?.requestedBy ? `**Requested By:** <@${track.requestedBy}>` : '',
    ].filter(Boolean).join('\n');

    return createEmbed({
        color: THEMES.MUSIC,
        author: { name: 'Now Playing • EyeDaemon Music', iconURL: 'https://cdn.discordapp.com/emojis/1049581898718916608.webp' },
        description,
        thumbnail,
    });
}

/**
 * Music Interactive Control Action Rows
 */
function musicControlsRow(options = {}) {
    const { isPaused = false, loopMode = 'off' } = options;

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('music_play_pause')
            .setEmoji(isPaused ? '▶️' : '⏸️')
            .setLabel(isPaused ? 'Resume' : 'Pause')
            .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('music_skip')
            .setEmoji('⏭️')
            .setLabel('Skip')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('music_stop')
            .setEmoji('⏹️')
            .setLabel('Stop')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('music_loop')
            .setEmoji('🔁')
            .setLabel(`Loop: ${loopMode.toUpperCase()}`)
            .setStyle(loopMode !== 'off' ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('music_volume_down')
            .setEmoji('🔉')
            .setLabel('Vol -10%')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('music_volume_up')
            .setEmoji('🔊')
            .setLabel('Vol +10%')
            .setStyle(ButtonStyle.Secondary)
    );

    return [row1, row2];
}

/**
 * Economy Balance Card
 */
function balanceCard(user, data = {}) {
    const wallet = data.wallet || 0;
    const bank = data.bank || 0;
    const total = wallet + bank;
    const rank = data.rank ? `#${data.rank}` : 'N/A';

    return createEmbed({
        color: THEMES.ECONOMY,
        author: { name: `${user.username}'s Financial Portfolio`, iconURL: user.displayAvatarURL?.() || undefined },
        thumbnail: 'https://cdn.discordapp.com/emojis/849313626159677461.webp',
        fields: [
            { name: `${EMOJIS.WALLET} Cash Wallet`, value: formatMoney(wallet), inline: true },
            { name: `${EMOJIS.BANK} Bank Account`, value: formatMoney(bank), inline: true },
            { name: `${EMOJIS.COIN} Net Worth`, value: formatMoney(total), inline: true },
            { name: `${EMOJIS.RANK} Server Wealth Rank`, value: `\`${rank}\``, inline: true },
        ],
        footerText: 'Tip: Deposit cash to protect your coins from theft and blackjack bets!'
    });
}

/**
 * Economy Blackjack Card
 */
function blackjackCard(game) {
    const playerHandStr = game.playerHand.map(c => `\`[${c.suit} ${c.rank}]\``).join(' ');
    const dealerHandStr = game.dealerHand.map(c => `\`[${c.suit} ${c.rank}]\``).join(' ');

    let color = THEMES.ECONOMY;
    let statusText = 'Game in progress... Hit or Stand?';

    if (game.status === 'completed' || game.status === 'bust') {
        if (game.result === 'win') {
            color = THEMES.SUCCESS;
            statusText = `🎉 **You WON ${formatMoney(game.winAmount || game.bet * 2)}!**`;
        } else if (game.result === 'lose' || game.status === 'bust') {
            color = THEMES.ERROR;
            statusText = `💀 **You LOST ${formatMoney(game.bet)}!**`;
        } else {
            color = THEMES.WARNING;
            statusText = `🤝 **Push (Tie)! Your bet of ${formatMoney(game.bet)} has been returned.**`;
        }
    }

    const description = [
        `**Bet Amount:** ${formatMoney(game.bet)}`,
        '',
        `**Dealer's Hand:** ${dealerHandStr}`,
        `**Dealer Value:** \`${game.dealerValue}\``,
        '',
        `**Your Hand:** ${playerHandStr}`,
        `**Your Value:** \`${game.playerValue}\``,
        '',
        `### ${statusText}`
    ].join('\n');

    return createEmbed({
        color,
        title: '🃏 Blackjack Casino Table',
        description,
    });
}

/**
 * Leveling Rank Card
 */
function rankCard(user, data = {}) {
    const level = data.level || 0;
    const xp = data.xp || 0;
    const nextLevelXP = data.nextLevelXP || 100;
    const rank = data.rank || 1;
    const progress = progressBar(xp, nextLevelXP, 12, '▰', '▱');

    return createEmbed({
        color: THEMES.LEVELING,
        author: { name: `${user.username}'s Level Card`, iconURL: user.displayAvatarURL?.() || undefined },
        thumbnail: user.displayAvatarURL?.({ size: 256 }) || undefined,
        description: [
            `### Level **${level}** ${EMOJIS.LEVEL}`,
            `**Server Rank:** \`#${rank}\` ${rank === 1 ? EMOJIS.MEDAL_1 : rank === 2 ? EMOJIS.MEDAL_2 : rank === 3 ? EMOJIS.MEDAL_3 : ''}`,
            '',
            `**Progress to Level ${level + 1}:**`,
            `${progress}`,
            `\`${formatNumber(xp)}\` / \`${formatNumber(nextLevelXP)} XP\``,
        ].join('\n'),
    });
}

/**
 * Moderation Action Log Card
 */
function moderationCard(data = {}) {
    const { action, target, moderator, reason = 'No reason provided', duration, caseId } = data;
    const colors = {
        WARN: THEMES.WARNING,
        TIMEOUT: THEMES.WARNING,
        KICK: THEMES.ERROR,
        BAN: THEMES.ERROR,
        UNBAN: THEMES.SUCCESS,
        PURGE: THEMES.INFO,
    };

    const embed = createEmbed({
        color: colors[action.toUpperCase()] || THEMES.MODERATION,
        title: `${EMOJIS.SHIELD} Moderation Action • ${action.toUpperCase()}`,
        fields: [
            { name: 'Target User', value: `${target.tag || target.username || target.id} (<@${target.id}>)`, inline: true },
            { name: 'Moderator', value: `${moderator.tag || moderator.username || 'System'} (<@${moderator.id}>)`, inline: true },
            ...(duration ? [{ name: 'Duration', value: `\`${duration}\``, inline: true }] : []),
            { name: 'Reason', value: `\`\`\`${reason}\`\`\``, inline: false },
        ],
        footerText: caseId ? `Case #${caseId} • EyeDaemon Security` : 'EyeDaemon Security',
    });

    return embed;
}

/**
 * Interactive Help Navigation Cards
 */
function helpMainCard(modules = []) {
    const description = [
        '### Welcome to EyeDaemon Unified Command Center 🚀',
        'Explore the categories below to browse all available commands and interactive tools.',
        '',
        '**Available Modules:**',
        ...modules.map(m => `> **${m.emoji || '🔹'} ${m.name}** — ${m.description} (\`${m.commandsCount} cmds\`)`),
        '',
        subtext('Select a category from the dropdown or buttons below to view detailed command guides.')
    ].join('\n');

    return createEmbed({
        color: THEMES.BRAND,
        title: '📚 EyeDaemon Master Help Index',
        description,
    });
}

// ── 7. Safe Interaction Response Handler ───────────────────────────────────

/**
 * Universal safe reply / edit / followUp dispatcher
 * Handles all deferred, replied, and fresh interaction states gracefully.
 * @param {Object} interaction - Discord interaction
 * @param {Object|EmbedBuilder|string} payload - Message content or embed or options
 * @param {Object} [options={}] - Additional flags (ephemeral, followUp)
 */
async function send(interaction, payload, options = {}) {
    if (!interaction) return;

    let responsePayload = {};

    if (payload instanceof EmbedBuilder) {
        responsePayload = { embeds: [payload] };
    } else if (typeof payload === 'string') {
        responsePayload = { content: payload };
    } else if (typeof payload === 'object') {
        responsePayload = { ...payload };
    }

    if (options.ephemeral) {
        responsePayload.flags = MessageFlags.Ephemeral;
    }

    try {
        if (options.followUp) {
            return await interaction.followUp(responsePayload);
        }

        if (interaction.replied) {
            return await interaction.followUp(responsePayload);
        }

        if (interaction.deferred) {
            return await interaction.editReply(responsePayload);
        }

        return await interaction.reply(responsePayload);
    } catch (err) {
        // Last-resort fallback
        if (interaction.editReply && (interaction.deferred || interaction.replied)) {
            try {
                return await interaction.editReply(responsePayload);
            } catch {}
        }
        throw err;
    }
}

// Export full ResponseHelper suite
module.exports = {
    THEMES,
    EMOJIS,
    progressBar,
    formatDuration,
    formatTimestamp,
    formatNumber,
    formatMoney,
    subtext,
    createEmbed,
    success,
    error,
    warning,
    info,
    nowPlayingCard,
    musicControlsRow,
    balanceCard,
    blackjackCard,
    rankCard,
    moderationCard,
    helpMainCard,
    send,
};
