import assert from 'node:assert/strict';
import test from 'node:test';

import { parseAdbDevices, parseSimctlDevices } from '../src/devices/runtime-discovery.js';

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

test('parses adb real devices and emulators while ignoring unavailable rows', () => {
    const rows = parseAdbDevices(`List of devices attached\nemulator-5554 device product:sdk model:Pixel_9 transport_id:1\nABC123 device model:Galaxy_S25 transport_id:2\nNOPE unauthorized usb:1-1\n`);
    assert.deepEqual(rows, [
        { serial: 'emulator-5554', modelHint: 'Pixel 9' },
        { serial: 'ABC123', modelHint: 'Galaxy S25' },
    ]);
});
