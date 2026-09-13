import assert from 'node:assert/strict';
import test from 'node:test';

import { configuredDeviceWorkers, DeviceWorkerClient } from '../src/device-workers.js';

test('device worker descriptors are explicit, unique, and share the configured bearer token', () => {
    const workers = configuredDeviceWorkers(
        'macstudio=http://macstudio:3010,air=https://air.example.test/worker/',
        'shared-secret',
    );
    assert.deepEqual(workers.map(({ id }) => id), ['macstudio', 'air']);
    assert.equal(workers[0]?.url.href, 'http://macstudio:3010/');
    assert.equal(workers[1]?.token, 'shared-secret');
    assert.throws(() => configuredDeviceWorkers('same=http://one:1,same=http://two:2'), /Duplicate/);
});

test('device worker client authenticates and proxies screen/action calls without exposing WDA directly', async () => {
    const requests: Request[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
        const request = new Request(input, init);
        requests.push(request);
        if (request.url.endsWith('/v1/host')) {
            return Response.json({ id: 'macstudio', hostname: 'studio', os: 'darwin', arch: 'arm64', capabilities: ['ios.physical'], tools: { appium: true, appiumRuntime: true, xcrun: true, adb: false } });
        }
        if (request.url.endsWith('/info')) {
            return Response.json({ screenSize: { width: 390, height: 844 }, scale: 3 });
        }
        return Response.json({ ok: true });
    };
    const client = new DeviceWorkerClient({ id: 'macstudio', url: new URL('http://macstudio:3010/'), token: 'secret' }, fetchImpl);
    const info = await client.getScreenInfo('udid / 1');
    const host = await client.host();
    await client.performAction('udid / 1', { type: 'home' });
    await client.updateConfig({
        name: 'Phone', udid: 'udid / 1', workerId: 'macstudio', passcode: '1234',
        wdaLocalPort: 8101, mjpegLocalPort: 9101, pluginData: { social: { accounts: ['@one'] } },
    });
    assert.equal(info.screenSize.width, 390);
    assert.equal(host.hostname, 'studio');
    assert.equal(requests.length, 4);
    assert.equal(requests.every((request) => request.headers.get('authorization') === 'Bearer secret'), true);
    assert.match(requests[0]!.url, /\/v1\/devices\/udid%20%2F%201\/info$/);
    assert.match(requests[1]!.url, /\/v1\/host$/);
    assert.equal(await requests[2]!.clone().json().then((body) => body.type), 'home');
    const config = await requests[3]!.clone().json() as Record<string, unknown>;
    assert.equal(config.name, 'Phone');
    assert.equal('passcode' in config, false);
    assert.equal('wdaLocalPort' in config, false);
    assert.equal('mjpegLocalPort' in config, false);
});
