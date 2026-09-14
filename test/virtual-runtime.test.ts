import assert from 'node:assert/strict';
import test from 'node:test';

import { parseVirtualSimulators } from '../src/devices/virtual-runtime.js';

test('parses available iOS simulator definitions and preserves boot state', () => {
    const runtimes = parseVirtualSimulators(JSON.stringify({
        devices: {
            'com.apple.CoreSimulator.SimRuntime.iOS-26-0': [
                { name: 'iPhone 17 Pro', udid: 'SIM-1', state: 'Booted', isAvailable: true },
                { name: 'iPhone Air', udid: 'SIM-2', state: 'Shutdown', isAvailable: true },
                { name: 'Unavailable', udid: 'SIM-3', state: 'Shutdown', isAvailable: false },
            ],
        },
    }));
    assert.deepEqual(runtimes.map(({ id, state, osVersion }) => ({ id, state, osVersion })), [
        { id: 'SIM-1', state: 'booted', osVersion: '26.0' },
        { id: 'SIM-2', state: 'shutdown', osVersion: '26.0' },
    ]);
});
