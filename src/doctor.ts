import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type DoctorStatus = 'pass' | 'warn' | 'fail';

export interface DoctorCheck {
    id: string;
    status: DoctorStatus;
    summary: string;
    detail?: string;
}

export interface DoctorReport {
    ok: boolean;
    sourceReady: boolean;
    realDeviceReady: boolean;
    checks: DoctorCheck[];
}

export interface CommandResult {
    status: number;
    stdout: string;
    stderr: string;
}

export type DoctorCommandRunner = (command: string, args: readonly string[]) => CommandResult;

export const systemCommandRunner: DoctorCommandRunner = (command, args) => {
    const result = spawnSync(command, [...args], { encoding: 'utf8' });
    return {
        status: result.status ?? 127,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? result.error?.message ?? '',
    };
};

function command(runner: DoctorCommandRunner, name: string, args: readonly string[] = []): CommandResult {
    try {
        return runner(name, args);
    } catch (error) {
        return { status: 127, stdout: '', stderr: error instanceof Error ? error.message : String(error) };
    }
}

function major(version: string): number {
    const match = version.match(/^(?:v)?(\d+)/);
    return match ? Number(match[1]) : 0;
}

function physicalDeviceLines(output: string): string[] {
    const section = output.split('== Simulators ==')[0] ?? output;
    return section.split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('==') && !/Mac \(/i.test(line));
}

export function collectDoctorReport(
    runner: DoctorCommandRunner = systemCommandRunner,
    env: NodeJS.ProcessEnv = process.env,
    cwd = process.cwd(),
): DoctorReport {
    const checks: DoctorCheck[] = [];

    const nodeVersion = process.version;
    checks.push(major(nodeVersion) >= 22
        ? { id: 'node', status: 'pass', summary: `Node ${nodeVersion}` }
        : { id: 'node', status: 'fail', summary: `Node ${nodeVersion}`, detail: 'Node 22 or newer is required.' });

    const xcodeSelect = command(runner, 'xcode-select', ['-p']);
    const developerDir = xcodeSelect.stdout.trim();
    const fullXcode = xcodeSelect.status === 0 && /Xcode\.app\/Contents\/Developer$/.test(developerDir);
    if (!fullXcode) {
        checks.push({
            id: 'xcode', status: 'fail', summary: 'Full Xcode is not selected',
            detail: developerDir
                ? `xcode-select points to ${developerDir}; select /Applications/Xcode.app/Contents/Developer.`
                : (xcodeSelect.stderr.trim() || 'Install and select full Xcode.'),
        });
    } else {
        const xcodebuild = command(runner, 'xcodebuild', ['-version']);
        checks.push(xcodebuild.status === 0
            ? { id: 'xcode', status: 'pass', summary: xcodebuild.stdout.trim().replace(/\n/g, ' · ') }
            : { id: 'xcode', status: 'fail', summary: 'xcodebuild is unavailable', detail: xcodebuild.stderr.trim() });
    }

    const appiumPath = path.resolve(cwd, 'node_modules/appium/index.js');
    checks.push(existsSync(appiumPath)
        ? { id: 'appium', status: 'pass', summary: 'Local Appium package is installed' }
        : { id: 'appium', status: 'fail', summary: 'Local Appium package is missing', detail: 'Run npm ci.' });

    const xcuitestPath = path.resolve(cwd, '.appium2/node_modules/appium-xcuitest-driver');
    checks.push(existsSync(xcuitestPath)
        ? { id: 'xcuitest', status: 'pass', summary: 'Pinned XCUITest driver is installed' }
        : { id: 'xcuitest', status: 'warn', summary: 'XCUITest driver is not prepared', detail: 'Run npm run appium:install-driver.' });

    const docker = command(runner, 'docker', ['--version']);
    checks.push(docker.status === 0
        ? { id: 'database-runtime', status: 'pass', summary: docker.stdout.trim() || 'Docker is available' }
        : {
            id: 'database-runtime', status: env.DATABASE_URL && !env.DATABASE_URL.includes('CHANGE_ME') ? 'warn' : 'warn',
            summary: 'Docker is unavailable',
            detail: 'The bundled PostgreSQL cannot start; configure an external DATABASE_URL or install Docker.',
        });

    const envPath = path.resolve(cwd, '.env');
    checks.push(existsSync(envPath)
        ? { id: 'configuration', status: 'pass', summary: '.env exists' }
        : { id: 'configuration', status: 'warn', summary: '.env is not configured', detail: 'Copy .env.example to .env before a live run.' });

    if (fullXcode) {
        const devices = command(runner, 'xcrun', ['xctrace', 'list', 'devices']);
        const physical = devices.status === 0 ? physicalDeviceLines(devices.stdout) : [];
        checks.push(physical.length
            ? { id: 'iphone', status: 'pass', summary: `${physical.length} physical iOS device${physical.length === 1 ? '' : 's'} visible`, detail: physical.join(' · ') }
            : { id: 'iphone', status: 'fail', summary: 'No physical iPhone is visible', detail: devices.stderr.trim() || 'Connect, unlock, trust, and enable Developer Mode on an iPhone.' });
    } else {
        checks.push({ id: 'iphone', status: 'fail', summary: 'iPhone discovery is blocked by the Xcode prerequisite' });
    }

    const sourceRequired = ['node', 'appium'];
    const realDeviceRequired = ['node', 'appium', 'xcode', 'iphone'];
    const failed = (ids: string[]) => checks.some((check) => ids.includes(check.id) && check.status === 'fail');
    return {
        ok: !checks.some((check) => check.status === 'fail'),
        sourceReady: !failed(sourceRequired),
        realDeviceReady: !failed(realDeviceRequired),
        checks,
    };
}

function renderHuman(report: DoctorReport): string {
    const icon: Record<DoctorStatus, string> = { pass: '✓', warn: '!', fail: '✗' };
    const lines = report.checks.map((check) => `${icon[check.status]} ${check.summary}${check.detail ? `\n  ${check.detail}` : ''}`);
    lines.push('', `Source readiness: ${report.sourceReady ? 'ready' : 'blocked'}`);
    lines.push(`Real-device readiness: ${report.realDeviceReady ? 'ready' : 'blocked'}`);
    return lines.join('\n');
}

async function main(): Promise<void> {
    const report = collectDoctorReport();
    if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
    else console.log(renderHuman(report));
    process.exitCode = report.realDeviceReady ? 0 : 1;
}

const entrypoint = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entrypoint && fileURLToPath(import.meta.url) === entrypoint) await main();
