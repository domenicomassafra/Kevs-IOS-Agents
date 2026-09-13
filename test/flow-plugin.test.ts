import assert from 'node:assert/strict';
import test from 'node:test';

import { portableFlowPlugin } from '../src/flow-plugin.js';
import { PluginRegistry } from '../src/registry.js';
import type { TaskExecutionContext } from '../src/plugin.js';

test('portable flows validate bounded mobile steps', () => {
    const registry = new PluginRegistry([portableFlowPlugin]);
    const input = registry.validate({
        deviceUdid: 'device-1', timing: { kind: 'now' },
        task: {
            pluginId: portableFlowPlugin.id, taskType: 'flow', taskVersion: 1,
            payload: { name: 'smoke', steps: [{ action: 'tap', x: 10, y: 20 }, { action: 'wait', milliseconds: 250 }] },
        },
    });
    assert.equal(input.task.payload.name, 'smoke');
    assert.throws(() => registry.validate({
        deviceUdid: 'device-1', timing: { kind: 'now' },
        task: {
            pluginId: portableFlowPlugin.id, taskType: 'flow', taskVersion: 1,
            payload: { name: 'bad', steps: [{ action: 'unknown-step' }] },
        },
    }), /unsupported/);
});

test('portable flow executes shared automation primitives in order', async () => {
    const registry = new PluginRegistry([portableFlowPlugin]);
    const task = registry.task({ pluginId: portableFlowPlugin.id, taskType: 'flow', taskVersion: 1, payload: {} });
    const calls: string[] = [];
    const context = {
        executionId: 'e1', attempt: 1, workspaceDirectory: '/tmp/mobile-flow',
        device: { udid: 'd1', name: 'device' }, devicePluginData: {}, assets: [],
        signal: new AbortController().signal,
        log: async (line: string) => { calls.push(`log:${line}`); },
        runProcess: async () => ({ exitCode: 0, stopped: false }),
        claimPipelineItem: async () => null,
        completePipelineItem: async () => {},
        failPipelineItem: async () => {},
        automation: {
            activateApp: async (id: string) => { calls.push(`launch:${id}`); },
            terminateApp: async (id: string) => { calls.push(`terminate:${id}`); },
            pause: async (ms: number) => { calls.push(`wait:${ms}`); },
            screenshot: async () => { calls.push('screenshot'); return Buffer.from('x'); },
            tap: async (x: number, y: number) => { calls.push(`tap:${x},${y}`); },
            swipe: async () => { calls.push('swipe'); },
            typeText: async (text: string) => { calls.push(`type:${text}`); },
            system: async (action: string) => { calls.push(`system:${action}`); },
        },
    } satisfies TaskExecutionContext;
    const payload = task.validate({
        name: 'demo',
        steps: [
            { action: 'launch', appId: 'com.example.app' },
            { action: 'tap', x: 10, y: 20 },
            { action: 'type', text: 'hello' },
            { action: 'home' },
            { action: 'screenshot' },
        ],
    }, { timingKind: 'now', devicePluginData: {} });
    const result = await task.execute(context, payload);
    assert.equal(result.exitCode, 0);
    assert.deepEqual(calls.filter((call) => !call.startsWith('log:')), [
        'launch:com.example.app', 'tap:10,20', 'type:hello', 'system:home', 'screenshot',
    ]);
});
