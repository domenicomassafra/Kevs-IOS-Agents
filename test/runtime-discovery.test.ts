import assert from 'node:assert/strict';
import test from 'node:test';

import { parseSimctlDevices } from '../src/devices/runtime-discovery.js';

test('parses available iOS simulators into Appium runtimes', () => {
    const devices = parseSimctlDevices(JSON.stringify({
        devices: {
            'com.apple.CoreSimulator.SimRuntime.iOS-26-0': [
                { name: 'iPhone 17', udid: 'SIM-1', state: 'Booted', isAvailable: true },
                { name: 'Unavailable', udid: 'SIM-2', isAvailable: false },
            ],
        },
    }));
    assert.deepEqual(devices, [{
        name: 'iPhone 17', osVersion: '26.0', udid: 'SIM-1', platform: 'ios', kind: 'simulator', automationBackend: 'appium',
    }]);
});
