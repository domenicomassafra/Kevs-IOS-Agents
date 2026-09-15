import crypto from 'node:crypto';
import { Readable } from 'node:stream';

import Fastify from 'fastify';

import { loadRegisteredDevices, mutateRegisteredDevices, normalizeDeviceTags, redactDevice, type RegisteredDevice } from './devices/registry.js';
import { RegistryWdaRemoteControl } from './devices/registry-remote.js';
import { requestWdaService } from './devices/wda-service-client.js';
import type { DeviceConnectionStatus } from './devices/connection-manager.js';
import type { RemoteAction } from './devices/wda-remote.js';
import type { JsonObject } from './types.js';
import { detectHostCapabilities } from './hosts/capabilities.js';
import { discoverRuntimeDevices, registerRuntimeDevice } from './devices/runtime-discovery.js';
import { changeVirtualRuntimeState, listVirtualRuntimes, type VirtualRuntimePlatform } from './devices/virtual-runtime.js';
import { DEVICE_WORKER_PROTOCOL_VERSION } from './device-workers.js';

function safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function bearer(value: string | undefined): string | undefined {
    return value?.startsWith('Bearer ') ? value.slice('Bearer '.length) : undefined;
}

async function localConnectionStatus(udid: string): Promise<DeviceConnectionStatus> {
    try {
        const response = await requestWdaService('/devices', { timeoutMs: 2_000 });
        if (response.statusCode >= 200 && response.statusCode < 300) {
            const status = (JSON.parse(response.body) as { devices: DeviceConnectionStatus[] }).devices.find((entry) => entry.udid === udid);
            if (status) return status;
        }
    } catch { /* fall through to direct probes */ }
    const registered = (await loadRegisteredDevices()).find((device) => device.udid === udid);
    if (!registered) throw Object.assign(new Error('Device is not registered on this worker'), { statusCode: 404 });
    const connected = (await discoverRuntimeDevices()).some((device) => device.udid === udid);
    const backend = registered.automationBackend
        ?? ((registered.platform ?? 'ios') === 'ios' && (registered.kind ?? 'physical') === 'physical' ? 'wda' : 'appium');
    const appiumHost = backend === 'appium'
        ? (process.env.APPIUM_RUNTIME_HOST ?? '127.0.0.1')
        : (process.env.APPIUM_HOST ?? '127.0.0.1');
    const appiumPort = backend === 'appium'
        ? Number(process.env.APPIUM_RUNTIME_PORT ?? 4726)
        : Number(process.env.APPIUM_PORT ?? 4725);
    const appiumReady = await fetch(`http://${appiumHost}:${appiumPort}/status`, {
        signal: AbortSignal.timeout(2_000),
    }).then((response) => response.ok).catch(() => false);
    if (backend === 'appium') {
        const ready = connected && appiumReady;
        return {
            udid,
            physical: connected ? 'connected' : 'disconnected',
            wda: ready ? 'ready' : connected ? 'connecting' : 'disconnected',
            appium: appiumReady ? 'ready' : 'unavailable',
            managed: false,
            message: ready ? 'Appium runtime is ready' : connected ? 'Waiting for Appium' : 'Start or reconnect this runtime',
            retryCount: 0,
            updatedAt: new Date().toISOString(),
        };
    }
    let wda = false;
    try {
        wda = (await fetch(`http://127.0.0.1:${registered.wdaLocalPort ?? 8100}/status`, { signal: AbortSignal.timeout(2_000) })).ok;
    } catch { /* unavailable */ }
    return {
        udid,
        physical: connected ? 'connected' : 'disconnected',
        wda: wda ? 'ready' : connected ? 'connecting' : 'disconnected',
        appium: appiumReady ? 'ready' : 'unavailable',
        managed: false,
        message: wda ? 'WDA is ready' : connected ? 'Waiting for WDA' : 'Reconnect the USB cable',
        retryCount: 0,
        updatedAt: new Date().toISOString(),
    };
}

export interface StartDeviceWorkerServerOptions {
    host?: string;
    port?: number;
    token?: string;
    workerId?: string;
    logger?: boolean;
}

export async function startDeviceWorkerServer(options: StartDeviceWorkerServerOptions = {}) {
    const host = options.host ?? process.env.DEVICE_WORKER_HOST ?? '127.0.0.1';
    const port = options.port ?? Number(process.env.DEVICE_WORKER_PORT ?? 3010);
    const token = options.token ?? process.env.PHONE_FARM_DEVICE_WORKER_TOKEN;
    const workerId = options.workerId ?? process.env.PHONE_FARM_WORKER_ID ?? 'mac-worker';
    const nonLoopback = !['127.0.0.1', '::1', 'localhost'].includes(host);
    if (nonLoopback && !token) throw new Error('PHONE_FARM_DEVICE_WORKER_TOKEN is required when the device worker binds outside loopback');
    if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error('DEVICE_WORKER_PORT must be a valid TCP port');

    const app = Fastify({ logger: options.logger ?? false, bodyLimit: 128 * 1024 });
    const remote = new RegistryWdaRemoteControl();
    app.addHook('onRequest', async (request, reply) => {
        if (!token) return;
        const supplied = bearer(request.headers.authorization);
        if (!supplied || !safeEqual(supplied, token)) return reply.code(401).send({ error: 'Device worker authentication required' });
    });

    app.get('/health', async () => ({
        ok: true,
        role: 'device-worker',
        workerId,
        protocolVersion: DEVICE_WORKER_PROTOCOL_VERSION,
        platforms: ['ios'] as const,
    }));
    app.get('/v1/host', async () => detectHostCapabilities({ id: workerId }));
    app.get('/v1/runtime-devices', async () => ({ devices: await discoverRuntimeDevices() }));
    app.get('/v1/virtual-runtimes', async () => ({ runtimes: await listVirtualRuntimes() }));
    app.post<{ Params: { platform: VirtualRuntimePlatform; id: string; action: 'boot' | 'shutdown' } }>(
        '/v1/virtual-runtimes/:platform/:id/:action', async (request, reply) => {
            if (request.params.platform !== 'ios' || !['boot', 'shutdown'].includes(request.params.action)) {
                return reply.code(400).send({ error: 'Unsupported virtual runtime action' });
            }
            await changeVirtualRuntimeState(request.params.platform, request.params.id, request.params.action);
            return reply.code(202).send({ ok: true });
        },
    );
    app.post<{ Params: { udid: string }; Body: { name?: string } }>('/v1/runtime-devices/:udid/register', async (request, reply) => {
        const device = await registerRuntimeDevice(request.params.udid, { name: request.body?.name });
        return reply.code(201).send({ device: redactDevice(device) });
    });
    app.get('/v1/devices', async () => {
        const [registered, connected] = await Promise.all([loadRegisteredDevices(), discoverRuntimeDevices()]);
        const online = new Map(connected.map((device) => [device.udid, device]));
        const statuses = await Promise.all(registered.map(async (device) => {
            try { return await localConnectionStatus(device.udid); } catch { return undefined; }
        }));
        return {
            workerId,
            devices: registered.map((device, index) => ({
                registered: redactDevice(device),
                connected: device.disabled ? null : online.get(device.udid) ?? null,
                ...(statuses[index] ? { status: statuses[index] } : {}),
            })),
        };
    });

    app.get<{ Params: { udid: string } }>('/v1/devices/:udid/info', async (request, reply) => {
        const device = (await discoverRuntimeDevices()).find(({ udid }) => udid === request.params.udid);
        if (!device) return reply.code(404).send({ error: 'Device is not connected to this worker' });
        return remote.getScreenInfo(device.udid);
    });
    app.get<{ Params: { udid: string } }>('/v1/devices/:udid/source', async (request) => remote.getAccessibilityTree(request.params.udid));
    app.get<{ Params: { udid: string } }>('/v1/devices/:udid/screenshot', async (request, reply) => (
        reply.header('cache-control', 'no-store').type('image/png').send(await remote.getScreenshot(request.params.udid))
    ));
    app.get<{ Params: { udid: string } }>('/v1/devices/:udid/stream', async (request, reply) => {
        const abort = new AbortController();
        request.raw.once('close', () => abort.abort());
        const upstream = await remote.getMjpegStream(request.params.udid, abort.signal);
        if (!upstream.body) return reply.code(503).send({ error: 'Device stream is unavailable' });
        return reply.header('cache-control', 'no-store, no-cache, must-revalidate')
            .type(upstream.headers.get('content-type') ?? 'multipart/x-mixed-replace; boundary=--BoundaryString')
            .send(Readable.from(upstream.body as AsyncIterable<Uint8Array>));
    });
    app.post<{ Params: { udid: string }; Body: RemoteAction }>('/v1/devices/:udid/action', async (request) => {
        await remote.performAction(request.params.udid, request.body);
        return { ok: true };
    });
    app.get<{ Params: { udid: string } }>('/v1/devices/:udid/locked', async (request) => ({ locked: await remote.isLocked(request.params.udid) }));
    app.get<{ Params: { udid: string } }>('/v1/devices/:udid/connection', async (request) => localConnectionStatus(request.params.udid));
    app.post<{ Params: { udid: string } }>('/v1/devices/:udid/reconnect', async (request, reply) => {
        const registered = (await loadRegisteredDevices()).find((device) => device.udid === request.params.udid);
        const backend = registered?.automationBackend
            ?? ((registered?.platform ?? 'ios') === 'ios' && (registered?.kind ?? 'physical') === 'physical' ? 'wda' : 'appium');
        if (backend === 'appium') {
            remote.forget(request.params.udid);
            return reply.code(202).send(await localConnectionStatus(request.params.udid));
        }
        try {
            const response = await requestWdaService(`/devices/${encodeURIComponent(request.params.udid)}/reconnect`, { method: 'POST', timeoutMs: 7_000 });
            if (response.statusCode === 404) return reply.code(404).send({ error: 'Device is not supervised on this worker' });
            return reply.code(response.statusCode).send(JSON.parse(response.body));
        } catch {
            remote.forget(request.params.udid);
            return reply.code(202).send(await localConnectionStatus(request.params.udid));
        }
    });
    app.patch<{
        Params: { udid: string };
        Body: Pick<RegisteredDevice, 'name' | 'tags' | 'coordinateProfile' | 'coordinates' | 'instagramCoordinates' | 'disabled'> & { pluginData?: Record<string, JsonObject> };
    }>('/v1/devices/:udid/config', async (request, reply) => {
        let found = false;
        await mutateRegisteredDevices((devices) => {
            const device = devices.find(({ udid }) => udid === request.params.udid);
            if (!device) return;
            found = true;
            if (request.body.name !== undefined) device.name = request.body.name;
            if (request.body.tags !== undefined) {
                const tags = normalizeDeviceTags(request.body.tags);
                if (tags.length) device.tags = tags;
                else delete device.tags;
            }
            if (request.body.coordinateProfile !== undefined) device.coordinateProfile = request.body.coordinateProfile;
            if (request.body.coordinates !== undefined) device.coordinates = request.body.coordinates;
            if (request.body.instagramCoordinates !== undefined) device.instagramCoordinates = request.body.instagramCoordinates;
            if (request.body.pluginData !== undefined) device.pluginData = request.body.pluginData;
            if (request.body.disabled === true) device.disabled = true;
            else if (request.body.disabled === false) delete device.disabled;
        });
        if (!found) return reply.code(404).send({ error: 'Device is not registered on this worker' });
        remote.forget(request.params.udid);
        return { ok: true };
    });

    await app.listen({ host, port });
    console.log(`Phone Farm device worker ${workerId} listening on http://${host}:${port}`);
    return app;
}

async function main(): Promise<void> {
    const app = await startDeviceWorkerServer({ logger: true });
    const shutdown = async () => { await app.close(); };
    process.once('SIGINT', () => void shutdown());
    process.once('SIGTERM', () => void shutdown());
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) await main();
