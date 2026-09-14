import { inject } from './support.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// registry.ts freezes its default path at first import, so set the env before
// any src module loads and pull everything in dynamically.
test('PATCH toggles disabled, scheduling is blocked, and the fragment lists it separately', async (context) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'pf-disable-api-'));
    const configPath = path.join(directory, 'devices.json');
    await writeFile(configPath, JSON.stringify([{ name: 'Phone A', udid: 'udid-a', tags: ['staging'], pluginData: {} }]));
    process.env.DEVICES_CONFIG_PATH = configPath;

    const { createApp } = await import('../src/api/app.js');
    const { defaultDashboardTheme } = await import('../src/dashboard-theme.js');
    const { PluginRegistry } = await import('../src/registry.js');
    type SchedulerRepository = import('../src/scheduler/repository.js').SchedulerRepository;

    let running = false;
    const scheduler = {
        async activeExecution(udid: string) { return running && udid === 'udid-a' ? { id: 'run-1' } : null; },
        async createTask() { return { id: 'sched-1' }; },
    } as unknown as SchedulerRepository;

    const app = await createApp({ plugins: new PluginRegistry([]), scheduler, dashboardTheme: defaultDashboardTheme });
    context.after(() => app.close());

    const disabled = await inject(app, { method: 'PATCH', url: '/api/devices/udid-a', payload: { disabled: true } });
    assert.equal(disabled.statusCode, 200);
    assert.equal(disabled.json().disabled, true);
    assert.equal(JSON.parse(await readFile(configPath, 'utf8'))[0].disabled, true);

    const blocked = await inject(app, {
        method: 'POST', url: '/api/schedules',
        payload: { deviceUdid: 'udid-a', runWindowMinutes: 30, timing: { kind: 'now' }, task: { pluginId: 'x', taskType: 'y', taskVersion: 1, payload: {} } },
    });
    assert.equal(blocked.statusCode, 409);

    const fragment = await inject(app, { method: 'GET', url: '/api/fragments/devices' });
    assert.match(fragment.body, /Disconnected devices \(1\)/);
    assert.match(fragment.body, /data-toggle-device="udid-a" data-disabled="false"/);
    assert.match(fragment.body, /data-device-entry/);
    assert.match(fragment.body, /data-status="disabled"/);
    assert.match(fragment.body, /data-platform="ios"/);
    assert.match(fragment.body, /data-name=/);
    assert.match(fragment.body, /data-kind="physical"/);
    assert.match(fragment.body, /device-actions-menu/);

    const reenabled = await inject(app, { method: 'PATCH', url: '/api/devices/udid-a', payload: { disabled: false } });
    assert.equal(reenabled.statusCode, 200);
    assert.equal(reenabled.json().disabled, undefined);
    assert.equal(JSON.parse(await readFile(configPath, 'utf8'))[0].disabled, undefined);

    const activeFragment = await inject(app, { method: 'GET', url: '/api/fragments/devices' });
    assert.match(activeFragment.body, /href="\/devices\/udid-a"[^>]*>Open/);
    assert.match(activeFragment.body, /href="\/automations\?template=flow&device=udid-a"[^>]*>Automate</);
    assert.match(activeFragment.body, /device-card-title/);
    assert.match(activeFragment.body, /More device actions/);
    assert.match(activeFragment.body, /#staging/);
    assert.doesNotMatch(activeFragment.body, /window\.prompt|<script>/);

    const devicePage = await inject(app, { method: 'GET', url: '/devices/udid-a' });
    assert.equal(devicePage.statusCode, 200);
    assert.match(devicePage.body, /id="device-rename-dialog"/);
    assert.match(devicePage.body, /id="device-enabled-toggle"/);
    assert.match(devicePage.body, /class="device-command-bar"/);
    assert.match(devicePage.body, /id="stream-mode"/);
    assert.match(devicePage.body, /id="refresh-preview"/);
    assert.match(devicePage.body, /class="device-manage-menu"/);
    assert.match(devicePage.body, /class="device-secondary-section wda-only"/);
    assert.match(devicePage.body, /data-runtime-disabled="false"/);
    assert.match(devicePage.body, /wda-only/);

    running = true;
    const unsafeBulkDisable = await inject(app, {
        method: 'POST', url: '/api/fleet/actions', payload: { deviceUdids: ['udid-a'], action: 'disable' },
    });
    assert.equal(unsafeBulkDisable.statusCode, 200);
    assert.equal(unsafeBulkDisable.json().ok, false);
    assert.equal(unsafeBulkDisable.json().affected, 0);
    assert.match(unsafeBulkDisable.json().results[0].message, /clear queue \/ stop before disabling/);
    assert.equal(JSON.parse(await readFile(configPath, 'utf8'))[0].disabled, undefined);

    running = false;
    const safeBulkDisable = await inject(app, {
        method: 'POST', url: '/api/fleet/actions', payload: { deviceUdids: ['udid-a'], action: 'disable' },
    });
    assert.equal(safeBulkDisable.statusCode, 200);
    assert.equal(safeBulkDisable.json().ok, true);
    assert.equal(safeBulkDisable.json().affected, 1);
    assert.equal(JSON.parse(await readFile(configPath, 'utf8'))[0].disabled, true);
});
