import assert from 'node:assert/strict';
import test from 'node:test';

import { detectHostCapabilities } from '../src/hosts/capabilities.js';

test('mac hosts advertise iOS physical and simulator only when the matching tools exist', async () => {
    const host = await detectHostCapabilities({
        id: 'studio', hostname: 'studio.test', platform: 'darwin', arch: 'arm64',
        appiumEntry: '/definitely/not/appium',
        appiumRuntimeEntry: '/definitely/not/appium-runtime',
        commandAvailable: async (command) => command === 'xcrun',
    });
    assert.equal(host.id, 'studio');
    assert.equal(host.online, true);
    assert.ok(host.metrics && host.metrics.cpuCount > 0);
    assert.ok(host.metrics && host.metrics.totalMemoryBytes >= host.metrics.freeMemoryBytes);
    assert.deepEqual(host.capabilities.sort(), ['ios.physical', 'ios.simulator', 'simctl'].sort());
});

test('a simulator-only Mac does not advertise physical iOS or WDA capabilities', async () => {
    const host = await detectHostCapabilities({
        id: 'studio', hostname: 'studio.test', platform: 'darwin', arch: 'arm64',
        physicalIosEnabled: false,
        appiumEntry: '/definitely/not/appium',
        appiumRuntimeEntry: '/definitely/not/appium-runtime',
        commandAvailable: async (command) => command === 'xcrun',
    });
    assert.deepEqual(host.capabilities.sort(), ['ios.simulator', 'simctl'].sort());
});
