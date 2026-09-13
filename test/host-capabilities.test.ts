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
    assert.deepEqual(host.capabilities.sort(), ['ios.physical', 'ios.simulator', 'simctl'].sort());
});

test('adb enables Android physical and emulator lanes on any worker OS', async () => {
    const host = await detectHostCapabilities({
        id: 'linux', platform: 'linux', arch: 'x64', appiumEntry: '/definitely/not/appium',
        appiumRuntimeEntry: '/definitely/not/appium-runtime',
        commandAvailable: async (command) => command === 'adb',
    });
    assert.deepEqual(host.capabilities.sort(), ['adb', 'android.emulator', 'android.physical'].sort());
});
