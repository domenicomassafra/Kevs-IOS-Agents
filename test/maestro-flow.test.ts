import assert from 'node:assert/strict';
import test from 'node:test';

import { exportMaestroFlow, importMaestroFlow } from '../src/flows/maestro.js';

test('imports a bounded Maestro accessibility flow into portable steps', () => {
    const flow = importMaestroFlow(`appId: com.example.app\nname: Sign in\n---\n- launchApp\n- tapOn: Email\n- inputText: hello@example.com\n- tapOn: Continue\n- assertVisible: Welcome\n`);
    assert.equal(flow.name, 'Sign in');
    assert.deepEqual(flow.steps, [
        { action: 'launch', appId: 'com.example.app' },
        { action: 'tapText', text: 'Email', timeoutMs: 10_000 },
        { action: 'type', text: 'hello@example.com' },
        { action: 'tapText', text: 'Continue', timeoutMs: 10_000 },
        { action: 'assertVisible', text: 'Welcome', timeoutMs: 1_000 },
    ]);
});

test('exports the lossless Maestro subset and rejects coordinate-only steps', () => {
    const yaml = exportMaestroFlow({
        name: 'Smoke',
        steps: [
            { action: 'launch', appId: 'com.example.app' },
            { action: 'tapText', text: 'Continue' },
            { action: 'assertVisible', text: 'Done' },
        ],
    });
    assert.match(yaml, /appId: com\.example\.app/);
    assert.match(yaml, /tapOn: Continue/);
    assert.throws(() => exportMaestroFlow({
        name: 'Coordinates', steps: [{ action: 'launch', appId: 'com.example.app' }, { action: 'tap', x: 1, y: 2 }],
    }), /no lossless Maestro mapping/);
});
