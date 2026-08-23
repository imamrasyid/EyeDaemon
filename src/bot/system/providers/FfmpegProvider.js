'use strict';

const { spawn } = require('child_process');
const logger = require('../helpers/LoggerHelper');
const { AudioError } = require('../core/Errors');

/**
 * FfmpegProvider - Wrapper for ffmpeg audio processing operations
 * Handles audio filtering, format conversion, and stream processing
 */
class FfmpegProvider {
    constructor(config = {}) {
        this.config = config;
        let defaultPath = 'ffmpeg';

        // On Android/Termux, always use system ffmpeg from PATH (pkg install ffmpeg)
        if (process.platform !== 'android') {
            try {
                const ffmpegStatic = require('ffmpeg-static');
                if (ffmpegStatic) defaultPath = ffmpegStatic;
            } catch {
                // ffmpeg-static not available, fallback to system PATH
            }
        }

        this.ffmpegPath = config.ffmpegPath || process.env.FFMPEG_PATH || defaultPath;
    }

    /**
     * Process audio stream with optional filters and seek
     * @param {Object} options - Processing options
     * @param {import('stream').Readable} options.inputStream - Input audio stream
     * @param {number} options.start - Start position in seconds
     * @param {string} options.filter - Audio filter preset
     * @param {string} options.format - Output format (webm, ogg, mp3)
     * @returns {import('stream').Readable} Processed audio stream
     */
    processAudio({
        inputStream,
        start = 0,
        filter = 'none',
        format = 'webm',
    }) {
        const args = [
            '-loglevel',
            'error',
            '-hide_banner',
            '-nostats',
            ...(start > 0 ? ['-ss', String(start)] : []),
            '-i',
            'pipe:0',
            '-vn', // Crucial: Disable video streams so ffmpeg never invokes video codecs (e.g. libvpx-vp9)
            '-sn', // Disable subtitle streams
            '-dn', // Disable data streams
            ...this.buildFilterArgs(filter),
            '-f',
            format === 'opus' ? 'opus' : format,
            '-c:a',
            format === 'mp3' ? 'libmp3lame' : 'libopus',
            '-ar',
            '48000',
            '-ac',
            '2',
            '-b:a',
            '128k',
            'pipe:1',
        ];

        logger.debug('Spawning ffmpeg for audio processing', {
            start,
            filter,
            format,
            args,
        });

        const proc = spawn(this.ffmpegPath, args, {
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let isClosed = false;

        // Cleanup helper to safely terminate child process
        const cleanup = () => {
            if (isClosed) return;
            isClosed = true;
            try {
                if (!proc.stdin.destroyed) proc.stdin.destroy();
                if (!proc.stdout.destroyed) proc.stdout.destroy();
                if (!proc.killed) proc.kill('SIGKILL');
            } catch {}
        };

        // Pipe input to ffmpeg stdin
        inputStream.pipe(proc.stdin);

        // Handle input stream errors and premature close
        inputStream.on('error', (error) => {
            if (error.code !== 'ERR_STREAM_PREMATURE_CLOSE' && error.code !== 'EPIPE') {
                logger.debug('Input stream error', { error: error.message });
            }
            cleanup();
        });

        // Handle errors
        let errorOutput = '';
        proc.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        proc.on('error', (error) => {
            logger.error('ffmpeg spawn error', { error: error.message, filter });
            cleanup();
        });

        proc.on('close', (code) => {
            // Error codes like 4294967274 or SIGTERM are normal when stream is stopped/skipped early
            if (code !== 0 && code !== null && code !== 4294967274 && !isClosed) {
                logger.debug('ffmpeg closed with output', { code, error: errorOutput.trim(), filter });
            } else {
                logger.debug('ffmpeg process completed', { filter, format });
            }
            cleanup();
        });

        // Handle stdout errors
        proc.stdout.on('error', (error) => {
            if (error.code !== 'ERR_STREAM_PREMATURE_CLOSE' && error.code !== 'EPIPE') {
                logger.debug('ffmpeg stdout stream closed', { error: error.message });
            }
            cleanup();
        });

        return proc.stdout;
    }

    /**
     * Build ffmpeg filter arguments based on preset
     * @param {string} preset - Filter preset name or dynamic filter
     * @returns {Array<string>} ffmpeg arguments for the filter
     */
    buildFilterArgs(preset) {
        if (!preset || preset === 'none') {
            return [];
        }

        // Predefined filter presets
        const filters = {
            bassboost: ['-af', 'bass=g=10'],
            nightcore: ['-af', 'asetrate=48000*1.1,atempo=1.1,aresample=48000'],
            vaporwave: ['-af', 'asetrate=44100*0.85,atempo=1,aresample=44100'],
            '8d': ['-af', 'apulsator=mode=sine:hz=0.09'],
            karaoke: ['-af', 'stereotools=mlev=0.015'],
        };

        if (filters[preset]) {
            logger.debug('Using predefined filter', { preset });
            return filters[preset];
        }

        // Handle dynamic filters
        if (preset.startsWith('pitch:')) {
            const pitchValue = preset.split(':')[1];
            const pitch = Math.max(0.5, Math.min(2, Number(pitchValue) || 1));
            logger.debug('Using dynamic pitch filter', { preset, pitch });
            return ['-af', `asetrate=48000*${pitch},aresample=48000`];
        }

        if (preset.startsWith('speed:')) {
            const speedValue = preset.split(':')[1];
            const speed = Math.max(0.5, Math.min(2, Number(speedValue) || 1));
            logger.debug('Using dynamic speed filter', { preset, speed });
            return ['-af', `atempo=${speed}`];
        }

        logger.warn('Unknown filter preset, using none', { preset });
        return [];
    }
}

module.exports = FfmpegProvider;
