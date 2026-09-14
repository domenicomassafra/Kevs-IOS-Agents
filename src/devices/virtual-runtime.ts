import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type VirtualRuntimePlatform = 'ios';
export type VirtualRuntimeState = 'booted' | 'shutdown';

export interface VirtualRuntime {
    id: string;
    name: string;
    platform: VirtualRuntimePlatform;
    kind: 'simulator';
    state: VirtualRuntimeState;
    osVersion?: string;
}

function iosRuntimeVersion(runtime: string): string {
    const tail = runtime.split('.').at(-1) ?? runtime;
    return tail.replace(/^iOS-/, '').replaceAll('-', '.');
}

export function parseVirtualSimulators(stdout: string): VirtualRuntime[] {
    const body = JSON.parse(stdout) as {
        devices?: Record<string, Array<{ name?: string; udid?: string; state?: string; isAvailable?: boolean }>>;
    };
    return Object.entries(body.devices ?? {}).flatMap(([runtime, devices]) => devices.flatMap((device) => {
        if (!device.udid || device.isAvailable === false) return [];
        return [{
            id: device.udid,
            name: device.name ?? `iOS Simulator ${device.udid.slice(-6)}`,
            platform: 'ios' as const,
            kind: 'simulator' as const,
            state: device.state === 'Booted' ? 'booted' as const : 'shutdown' as const,
            osVersion: iosRuntimeVersion(runtime),
        }];
    }));
}

async function iosVirtualRuntimes(): Promise<VirtualRuntime[]> {
    if (process.platform !== 'darwin') return [];
    try {
        const { stdout } = await execFileAsync('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], {
            timeout: 8_000, maxBuffer: 8 * 1024 * 1024,
        });
        return parseVirtualSimulators(stdout);
    } catch {
        return [];
    }
}

export async function listVirtualRuntimes(): Promise<VirtualRuntime[]> {
    return iosVirtualRuntimes();
}

async function requiredRuntime(platform: VirtualRuntimePlatform, id: string): Promise<VirtualRuntime> {
    const runtime = (await listVirtualRuntimes()).find((candidate) => candidate.platform === platform && candidate.id === id);
    if (!runtime) throw Object.assign(new Error(`Unknown ${platform} virtual runtime ${id}`), { statusCode: 404 });
    return runtime;
}

export async function changeVirtualRuntimeState(
    platform: VirtualRuntimePlatform,
    id: string,
    action: 'boot' | 'shutdown',
): Promise<void> {
    const runtime = await requiredRuntime(platform, id);
    if (process.platform !== 'darwin') throw Object.assign(new Error('iOS simulators require a macOS worker'), { statusCode: 409 });
    if (action === 'boot') {
        if (runtime.state === 'booted') return;
        await execFileAsync('xcrun', ['simctl', 'boot', runtime.id], { timeout: 30_000 });
        await execFileAsync('xcrun', ['simctl', 'bootstatus', runtime.id, '-b'], { timeout: 120_000 });
    } else {
        if (runtime.state === 'shutdown') return;
        await execFileAsync('xcrun', ['simctl', 'shutdown', runtime.id], { timeout: 30_000 });
    }
}
