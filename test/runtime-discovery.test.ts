import assert from 'node:assert/strict';
import test from 'node:test';

import { filterRuntimeDevicesForWorker, parseSimctlDevices } from '../src/devices/runtime-discovery.js';

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

test('simulator-only workers never advertise a connected physical iPhone', () => {
    const devices = [
        { name: 'Physical', osVersion: '26.0', udid: 'PHONE-1', platform: 'ios' as const, kind: 'physical' as const, automationBackend: 'wda' as const },
        { name: 'Simulator', osVersion: '26.0', udid: 'SIM-1', platform: 'ios' as const, kind: 'simulator' as const, automationBackend: 'appium' as const },
    ];
    assert.deepEqual(filterRuntimeDevicesForWorker(devices, false).map(({ udid }) => udid), ['SIM-1']);
    assert.deepEqual(filterRuntimeDevicesForWorker(devices, true).map(({ udid }) => udid), ['PHONE-1', 'SIM-1']);
});
