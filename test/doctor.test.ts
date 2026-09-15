import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { collectDoctorReport, type DoctorCommandRunner } from '../src/doctor.js';

function runner(fixtures: Record<string, { status?: number; stdout?: string; stderr?: string }>): DoctorCommandRunner {
    return (command, args) => {
        const key = `${command} ${args.join(' ')}`.trim();
        const fixture = fixtures[key] ?? { status: 127, stderr: 'missing fixture' };
        return { status: fixture.status ?? 0, stdout: fixture.stdout ?? '', stderr: fixture.stderr ?? '' };
    };
}

function doctorCwd(context: test.TestContext): string {
    const cwd = mkdtempSync(path.join(os.tmpdir(), 'phone-farm-doctor-'));
    context.after(() => rmSync(cwd, { recursive: true, force: true }));
    const appium = path.join(cwd, 'node_modules', 'appium');
    const appiumRuntime = path.join(cwd, 'node_modules', 'appium-runtime');
    mkdirSync(appium, { recursive: true });
    mkdirSync(appiumRuntime, { recursive: true });
    writeFileSync(path.join(appium, 'index.js'), '');
    writeFileSync(path.join(appiumRuntime, 'index.js'), '');
    return cwd;
}

test('doctor reports a missing full Xcode as a real-device blocker without blocking source readiness', (context) => {
    const report = collectDoctorReport(runner({
        'xcode-select -p': { stdout: '/Library/Developer/CommandLineTools\n' },
        'docker --version': { status: 127, stderr: 'not found' },
    }), {}, doctorCwd(context));
    assert.equal(report.sourceReady, true);
    assert.equal(report.realDeviceReady, false);
    assert.equal(report.checks.find(({ id }) => id === 'xcode')?.status, 'fail');
});

test('doctor recognizes full Xcode and a visible physical device', (context) => {
    const report = collectDoctorReport(runner({
        'xcode-select -p': { stdout: '/Applications/Xcode.app/Contents/Developer\n' },
        'xcodebuild -version': { stdout: 'Xcode 26.1\nBuild version 17B55' },
        'docker --version': { stdout: 'Docker version 28.0.0' },
        'xcrun xctrace list devices': { stdout: '== Devices ==\nDodo iPhone (26.0) (0000-AAAA)\nDodo Mac (26.0) (MAC)\n\n== Simulators ==\niPhone 17 (26.0) (SIM)\n' },
    }), {}, doctorCwd(context));
    assert.equal(report.realDeviceReady, true);
    assert.match(report.checks.find(({ id }) => id === 'iphone')?.summary ?? '', /1 physical/);
});

test('control-plane doctor does not require Xcode and requires Docker/database configuration', () => {
    const report = collectDoctorReport(runner({
        'docker --version': { stdout: 'Docker version 28.0.0' },
    }), {
        PHONE_FARM_ROLE: 'control-plane',
        DATABASE_URL: 'postgresql://phone_farm:secret@127.0.0.1:5432/phone_farm',
        PHONE_FARM_DEVICE_WORKERS: 'macstudio=http://macstudio:3010',
        PHONE_FARM_DEVICE_WORKER_TOKEN: 'worker-secret',
        PHONE_FARM_INTERNAL_TOKEN: 'internal-secret',
    }, process.cwd());
    assert.equal(report.runtimeReady, true);
    assert.equal(report.realDeviceReady, false);
    assert.equal(report.checks.some(({ id }) => id === 'xcode'), false);
    assert.equal(report.checks.find(({ id }) => id === 'database-runtime')?.status, 'pass');
});
