const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require("@discordjs/voice");
const { EmbedBuilder } = require("discord.js");
const fetch = (...a) => import("node-fetch").then(({ default: f }) => f(...a));
const { eyeBase, progressBarSize } = require("../config");
const { formatMs, progressBar } = require("./utils");
const { saveQueue, loadQueue, deleteQueue } = require("./storage");

const states = new Map(); // gid -> {connection, player, queue, now, volume, loop, filter, idleTimer}

/** Hitung idle timeout fleksibel berbasis durasi lagu terakhir */
function computeIdleTimeoutMs(track) {
    const dur = track?.durationMs || 0;
    if (dur >= 15 * 60_000) return 10 * 60_000; // >15 menit => 10 menit
    if (dur >= 5 * 60_000) return 8 * 60_000; // 5–15 menit => 8 menit
    return 5 * 60_000;                           // <5 menit => 5 menit
}

function getState(gid) {
    if (!states.has(gid)) {
        const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
        states.set(gid, { connection: null, player, queue: [], now: null, volume: 0.8, loop: "off", filter: "none", idleTimer: null });
    }
    return states.get(gid);
}

/** Dipanggil oleh voiceState.js saat channel kosong, atau bisa dipakai manual */
function scheduleIdleCleanup(gid, textChannel, basisTrack) {
    const s = getState(gid);
    if (s.idleTimer) clearTimeout(s.idleTimer);

    const timeout = computeIdleTimeoutMs(basisTrack || s.now || s.queue?.[0]);
    s.idleTimer = setTimeout(async () => {
        if (s.connection) {
            try { s.connection.destroy(); } catch { }
            s.connection = null;
        }
        s.now = null;
        s.queue = [];
        saveQueue(gid, s);
        deleteQueue(gid); // bersihkan dari SQLite supaya benar2 idle
        try { await textChannel?.send?.("💤 Tidak ada aktivitas, bot keluar otomatis."); } catch { }
        console.log(`🧹 Auto-cleanup idle guild ${gid}`);
    }, timeout);
}

async function ensureConnection(message) {
    const ch = message.member?.voice?.channel;
    if (!ch) throw new Error("❌ Kamu harus join voice channel dulu!");
    const s = getState(message.guild.id);
    if (s.connection) return s.connection;
    s.connection = joinVoiceChannel({ channelId: ch.id, guildId: message.guild.id, adapterCreator: message.guild.voiceAdapterCreator });
    return s.connection;
}

async function eyeInfo(query) {
    const r = await fetch(`${eyeBase}/info?query=${encodeURIComponent(query)}`);
    if (!r.ok) throw new Error(`INFO failed: ${r.status} ${r.statusText}`);
    const j = await r.json();
    if (!j.success) throw new Error(j.error || "info error");
    return j; // { title, url, durationSec, thumbnail }
}

async function play(ctx, query) {
    const guild = ctx.guild;
    const s = getState(guild.id);

    await ensureConnection(ctx);

    // 🔹 deteksi jenis konteks (message atau interaction)
    const user = ctx.author || ctx.user || ctx.member?.user;
    if (!user) throw new Error("Tidak dapat mendeteksi pengguna yang meminta lagu.");

    const meta = await eyeInfo(query);
    const track = {
        title: meta.title,
        url: meta.url,
        durationMs: (meta.durationSec || 0) * 1000,
        thumb: meta.thumbnail || null,
        requestedBy: { id: user.id, tag: user.tag },
        query,
    };

    s.queue.push(track);
    saveQueue(guild.id, s);

    if (!s.now) await startNext(guild.id, ctx.channel);
    else {
        const msg = `➕ Ditambahkan: **${track.title}** (${formatMs(track.durationMs)})`;
        if (ctx.reply) await ctx.reply(msg).catch(() => { });
        else await ctx.channel.send(msg);
    }
}

async function startNext(gid, textChannel, forcedStartMs = 0) {
    const s = getState(gid);

    // batalkan timer idle saat mau mulai/lanjut
    if (s.idleTimer) { clearTimeout(s.idleTimer); s.idleTimer = null; }

    // === ✅ Auto reconnect jika koneksi hilang ===
    if (!s.connection || !s.connection.joinConfig?.channelId) {
        try {
            const guild = textChannel.guild;
            const vc = textChannel.guild.members.me?.voice?.channel
                || textChannel.guild.members.cache.get(textChannel.client.user.id)?.voice?.channel;

            if (!vc) {
                await textChannel.send("⚠️ Tidak ada voice channel aktif. Gunakan `!play` lagi.");
                return;
            }

            s.connection = joinVoiceChannel({
                channelId: vc.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });
            console.log(`🔄 Reconnected to voice channel in ${guild.name}`);
        } catch (err) {
            console.error(`❌ Gagal reconnect voice channel: ${err.message}`);
            return;
        }
    }

    const head = s.queue[0];
    if (!head) {
        // antrian habis → langsung bersih, tetapi presence dibuat idle
        s.now = null;
        saveQueue(gid, s);
        if (s.connection) {
            try { s.connection.destroy(); } catch { }
            s.connection = null;
        }
        try {
            if (textChannel) await textChannel.send("✅ Tidak ada lagi lagu di antrian.");
        } catch { }
        if (textChannel?.client?.user) {
            textChannel.client.user.setPresence({
                activities: [{ name: "☕ ditemani playlist | 🎧", type: 2 }],
                status: "idle",
            });
        }
        // Tidak set idleTimer di sini (karena sudah left). voice idle diurus voiceState.js
        return;
    }

    // === Stream & play ===
    const streamUrl = `${eyeBase}/stream?query=${encodeURIComponent(
        head.query
    )}&start=${Math.floor(forcedStartMs / 1000)}&filter=${encodeURIComponent(
        s.filter
    )}`;
    const resp = await fetch(streamUrl);
    if (!resp.ok || !resp.body) {
        await textChannel.send(`⚠️ Gagal memutar: **${head.title}**`);
        s.queue.shift();
        saveQueue(gid, s);
        return startNext(gid, textChannel);
    }

    const resource = createAudioResource(resp.body, { inlineVolume: true });
    resource.volume.setVolume(s.volume);
    s.player.removeAllListeners();
    s.player.play(resource);
    s.connection.subscribe(s.player);

    s.now = {
        ...head,
        startedAtMs: Date.now(),
        startOffsetMs: forcedStartMs,
    };
    saveQueue(gid, s);

    // === Embed klasik ===
    const embed = new EmbedBuilder()
        .setColor(0x00b894)
        .setTitle("🎶 Now Playing")
        .setDescription(`[${head.title}](${head.url})`)
        .addFields(
            { name: "Durasi", value: head.durationMs ? formatMs(head.durationMs) : "—", inline: true },
            { name: "Diminta oleh", value: `<@${head.requestedBy.id}>`, inline: true },
            { name: "Volume", value: `${Math.round(s.volume * 100)}%`, inline: true },
            { name: "Loop", value: s.loop, inline: true },
            { name: "Filter", value: s.filter || "none", inline: true },
            { name: "Antrian", value: `${s.queue.length} lagu`, inline: true }
        );
    if (head.thumb) embed.setThumbnail(head.thumb);
    await textChannel.send({ embeds: [embed] });

    // === Presence update ===
    if (textChannel?.client?.user) {
        textChannel.client.user.setPresence({
            activities: [{ name: head.title, type: 2 }],
            status: "online",
        });
    }

    // === Next song on Idle ===
    s.player.once(AudioPlayerStatus.Idle, async () => {
        if (s.loop === "track") {
            // repeat same
        } else if (s.loop === "queue") {
            const first = s.queue.shift();
            s.queue.push(first);
        } else {
            s.queue.shift();
        }
        saveQueue(gid, s);
        await startNext(gid, textChannel);
    });
}

/* Commands (prefix/slash use these) */
function showQueue(msg) {
    const s = getState(msg.guild.id);
    if (!s.queue.length) return msg.channel.send("🎵 Queue kosong.");
    const lines = s.queue.map((t, i) => (i === 0 ? "▶️" : " " + i + ".") + ` ${t.title} (${t.durationMs ? formatMs(t.durationMs) : "—"})`);
    return msg.channel.send(`📜 **Daftar Antrian**\n${lines.join("\n")}`);
}

function skip(msg) {
    const s = getState(msg.guild.id);
    if (!s.now) return msg.channel.send("⚠️ Tidak ada lagu yang diputar.");
    s.player.stop();
    return msg.channel.send("⏭️ Skip!");
}

function stopAll(msg) {
    const s = getState(msg.guild.id);
    s.queue = [];
    s.now = null;
    s.player.stop();
    if (s.connection) {
        try { s.connection.destroy(); } catch { }
        s.connection = null;
    }
    saveQueue(msg.guild.id, s);
    deleteQueue(msg.guild.id);
    return msg.channel.send("⏹️ Stop & clear queue.");
}

function leave(msg) {
    const s = getState(msg.guild.id);
    if (s.connection) {
        try { s.connection.destroy(); } catch { }
        s.connection = null;
        s.queue = [];
        s.now = null;
        saveQueue(msg.guild.id, s);
        deleteQueue(msg.guild.id);
        return msg.channel.send("👋 Keluar voice channel.");
    }
    return msg.channel.send("⚠️ Tidak sedang di voice channel.");
}

function pause(msg) {
    const s = getState(msg.guild.id);
    return msg.channel.send(s.player.pause() ? "⏸️ Dijeda." : "⚠️ Gagal jeda.");
}

function resume(msg) {
    const s = getState(msg.guild.id);
    return msg.channel.send(s.player.unpause() ? "▶️ Dilanjutkan." : "⚠️ Gagal lanjut.");
}

function setVolume(msg, val) {
    const s = getState(msg.guild.id);
    const v = Math.max(0, Math.min(200, Number(val)));
    if (!isFinite(v)) return msg.channel.send("🔊 `!volume 0-200`");
    s.volume = v / 100;
    try {
        const res = s.player.state?.resource;
        if (res?.volume) res.volume.setVolume(s.volume);
    } catch { }
    return msg.channel.send(`🔊 Volume: **${v}%**`);
}

function toggleLoop(msg, mode) {
    const s = getState(msg.guild.id);
    const ok = ["off", "track", "queue"].includes((mode || "").toLowerCase());
    if (!ok) return msg.channel.send("`!loop off|track|queue`");
    s.loop = mode.toLowerCase();
    saveQueue(msg.guild.id, s);
    return msg.channel.send(`🔁 Loop: **${s.loop}**`);
}

function shuffle(msg) {
    const s = getState(msg.guild.id);
    if (s.queue.length <= 2) return msg.channel.send("⚠️ Queue terlalu sedikit.");
    const head = s.queue.shift();
    for (let i = s.queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [s.queue[i], s.queue[j]] = [s.queue[j], s.queue[i]];
    }
    s.queue.unshift(head);
    saveQueue(msg.guild.id, s);
    return msg.channel.send("🔀 Queue diacak!");
}

function removeIdx(msg, idx) {
    const s = getState(msg.guild.id);
    const i = Number(idx);
    if (!isFinite(i) || i < 1 || i >= s.queue.length) return msg.channel.send("`!remove <index>` (mulai 1)");
    const [rm] = s.queue.splice(i, 1);
    saveQueue(msg.guild.id, s);
    return msg.channel.send(`🗑️ Hapus: **${rm.title}**`);
}

function moveIdx(msg, from, to) {
    const s = getState(msg.guild.id);
    const f = Number(from), t = Number(to);
    if (![f, t].every(Number.isFinite)) return msg.channel.send("`!move <from> <to>`");
    if (f < 1 || t < 1 || f >= s.queue.length || t >= s.queue.length) return msg.channel.send("Index out of range.");
    const [it] = s.queue.splice(f, 1);
    s.queue.splice(t, 0, it);
    saveQueue(msg.guild.id, s);
    return msg.channel.send(`↔️ Pindah ke ${t}: **${it.title}**`);
}

function clearTail(msg) {
    const s = getState(msg.guild.id);
    if (s.queue.length <= 1) return msg.channel.send("Queue sudah bersih.");
    s.queue = [s.queue[0]];
    saveQueue(msg.guild.id, s);
    return msg.channel.send("🧹 Queue dibersihkan (menyisakan lagu aktif).");
}

function nowPlaying(msg) {
    const s = getState(msg.guild.id);
    if (!s.now) return msg.channel.send("Tidak ada yang diputar.");
    const elapsed = Date.now() - s.now.startedAtMs + (s.now.startOffsetMs || 0);
    const total = s.now.durationMs || 0;
    const bar = progressBar(elapsed, total, progressBarSize);
    const em = new EmbedBuilder()
        .setColor(0x0984e3)
        .setTitle("🎶 Now Playing")
        .setDescription(`[${s.now.title}](${s.now.url})`)
        .addFields(
            { name: "Posisi", value: `${formatMs(elapsed)} / ${total ? formatMs(total) : "—"}`, inline: true },
            { name: "Loop", value: s.loop, inline: true },
            { name: "Filter", value: s.filter || "none", inline: true }
        )
        .setFooter({ text: bar });
    if (s.now.thumb) em.setThumbnail(s.now.thumb);
    return msg.channel.send({ embeds: [em] });
}

async function seekTo(msg, ms) {
    const s = getState(msg.guild.id);
    if (!s.now) return msg.channel.send("⚠️ Tidak ada lagu.");
    s.player.stop(true);
    await startNext(msg.guild.id, msg.channel, ms);
}

function setFilter(msg, preset) {
    const s = getState(msg.guild.id);
    s.filter = preset || "none";
    if (s.now) {
        const elapsed = Date.now() - s.now.startedAtMs + (s.now.startOffsetMs || 0);
        s.player.stop(true);
        startNext(msg.guild.id, msg.channel, elapsed);
    }
    return msg.channel.send(`🎚️ Filter: **${s.filter}**`);
}

async function restoreForGuild(gid, channelFetcher) {
    const s = getState(gid);
    const saved = loadQueue(gid);
    if (!saved) return;
    s.queue = saved.queue || [];
    s.now = null; // mulai dari head baru
    if (s.queue.length && channelFetcher) {
        const { textChannel } = await channelFetcher(gid);
        if (textChannel) startNext(gid, textChannel);
    }
}

module.exports = {
    getState, ensureConnection, eyeInfo, play, startNext,
    showQueue, skip, stopAll, leave, pause, resume, setVolume, toggleLoop, shuffle,
    removeIdx, moveIdx, clearTail, nowPlaying, seekTo, setFilter, restoreForGuild,
    scheduleIdleCleanup, // ← diekspor untuk voiceState (opsional)
};
