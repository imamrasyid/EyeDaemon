'use strict';

const axios = require('axios');
const { Readable } = require('stream');
const HttpServer = require('../bot/system/server/HttpServer');

describe('Embedded HTTP & Health Server Suite', () => {
    let httpServer;
    let serverPort;
    let baseUrl;
    let mockClient;

    beforeAll(async () => {
        mockClient = {
            isReady: () => true,
            user: { tag: 'EyeDaemon#0001' },
            guilds: { cache: new Map([['g-1', {}]]) },
            db: { isReady: () => true },
            audioStreamService: {
                getAudioStream: jest.fn().mockImplementation(async () => {
                    const stream = new Readable({
                        read() {
                            this.push(Buffer.from('fake-audio-chunk'));
                            this.push(null);
                        }
                    });
                    return stream;
                })
            },
            metadataService: {
                getMetadata: jest.fn().mockResolvedValue({
                    title: 'Sample Song',
                    duration: 180,
                    uploader: 'Sample Artist'
                })
            }
        };

        // Use a test port
        serverPort = 39876;
        baseUrl = `http://127.0.0.1:${serverPort}`;

        httpServer = new HttpServer(mockClient, { port: serverPort, enabled: true });
        await httpServer.start();
    });

    afterAll(async () => {
        if (httpServer) {
            await httpServer.stop();
        }
    });

    test('GET /health returns healthy status and service metrics', async () => {
        const response = await axios.get(`${baseUrl}/health`);
        expect(response.status).toBe(200);
        expect(response.data.status).toBe('healthy');
        expect(response.data.service).toBe('EyeDaemon Unified');
        expect(response.data.bot.ready).toBe(true);
        expect(response.data.database.ready).toBe(true);
        expect(response.headers['x-powered-by']).toBe('EyeDaemon-Unified');
    });

    test('GET /api/health is an alias for health check', async () => {
        const response = await axios.get(`${baseUrl}/api/health`);
        expect(response.status).toBe(200);
        expect(response.data.status).toBe('healthy');
    });

    test('GET /api/audio/metadata returns metadata for query', async () => {
        const response = await axios.get(`${baseUrl}/api/audio/metadata?query=samplesong`);
        expect(response.status).toBe(200);
        expect(response.data.title).toBe('Sample Song');
        expect(mockClient.metadataService.getMetadata).toHaveBeenCalledWith('samplesong');
    });

    test('GET /api/audio/metadata returns 400 when query is missing', async () => {
        try {
            await axios.get(`${baseUrl}/api/audio/metadata`);
            throw new Error('Should have thrown 400');
        } catch (error) {
            expect(error.response.status).toBe(400);
            expect(error.response.data.error).toBe('Query parameter is required');
        }
    });

    test('GET /api/audio/stream pipes audio stream', async () => {
        const response = await axios.get(`${baseUrl}/api/audio/stream?query=samplesong&format=webm`, {
            responseType: 'arraybuffer'
        });
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('audio/webm');
        expect(response.data.length).toBeGreaterThan(0);
    });

    test('GET /api/audio/stream returns 400 when query is missing', async () => {
        try {
            await axios.get(`${baseUrl}/api/audio/stream`);
            throw new Error('Should have thrown 400');
        } catch (error) {
            expect(error.response.status).toBe(400);
            expect(error.response.data.error).toBe('Query parameter is required');
        }
    });
});
