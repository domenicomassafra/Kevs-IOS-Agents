import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { SemanticController } from '../src/semantic/controller.js';
import type { RemoteAction, RemoteControl } from '../src/devices/wda-remote.js';

test('semantic controller resolves refs to taps and redacts typed text from traces', async () => {
    const actions: RemoteAction[] = [];
    const remote: RemoteControl = {
        async getScreenInfo() { return { screenSize: { width: 390, height: 844 }, scale: 3 }; },
        async getAccessibilityTree() {
            return { type: 'Application', rect: { x: 0, y: 0, width: 390, height: 844 }, isVisible: true, children: [
                { type: 'Button', label: 'Go', rect: { x: 20, y: 100, width: 100, height: 40 }, isVisible: true, isEnabled: true },
            ] };
        },
        async getScreenshot() { return Buffer.alloc(0); },
        async getMjpegStream() { return new Response(new Uint8Array()); },
        async performAction(_udid, action) { actions.push(action); },
        async isLocked() { return false; },
    };
    const traces = await mkdtemp(path.join(os.tmpdir(), 'pf-semantic-traces-'));
    const controller = new SemanticController(remote, traces);
    const snapshot = await controller.snapshot('udid-a');
    await controller.tapRef('udid-a', snapshot.generation, 'e1');
    await controller.typeText('udid-a', 'super-secret-text');
    assert.deepEqual(actions[0], { type: 'tap', x: 70, y: 120 });
    assert.deepEqual(actions[1], { type: 'type', text: 'super-secret-text' });

    const files = await readdir(traces);
    assert.equal(files.length, 2);
    const bodies = await Promise.all(files.map((file) => readFile(path.join(traces, file), 'utf8')));
    assert.equal(bodies.some((body) => body.includes('super-secret-text')), false);
    assert.equal(bodies.some((body) => body.includes('"textLength": 17')), true);
});
