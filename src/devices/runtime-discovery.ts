import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { discoverConnectedDevices, type Device } from './discovery.js';
import { mutateRegisteredDevices, type RegisteredDevice } from './registry.js';

const execFileAsync = promisify(execFile);

export interface RuntimeDevice extends Device {
    platform: 'ios';
    kind: 'physical' | 'simulator';
    automationBackend: 'wda' | 'appium';
}

function iosRuntimeVersion(runtime: string): string {
    const tail = runtime.split('.').at(-1) ?? runtime;
    return tail.replace(/^iOS-/, '').replaceAll('-', '.');
}

export function parseSimctlDevices(stdout: string): RuntimeDevice[] {
    const body = JSON.parse(stdout) as { devices?: Record<string, Array<{ name?: string; udid?: string; state?: string; isAvailable?: boolean }>> };
    return Object.entries(body.devices ?? {}).flatMap(([runtime, devices]) => devices.flatMap((device) => {
        if (!device.udid || device.isAvailable === false) return [];
        return [{
            name: device.name ?? `iOS Simulator ${device.udid.slice(-6)}`,
            osVersion: iosRuntimeVersion(runtime),
            udid: device.udid,
            platform: 'ios' as const,
            kind: 'simulator' as const,
            automationBackend: 'appium' as const,
        }];
    }));
}

export async function discoverIosSimulators(): Promise<RuntimeDevice[]> {
    if (process.platform !== 'darwin') return [];
    try {
        const { stdout } = await execFileAsync('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], { maxBuffer: 8 * 1024 * 1024 });
        return parseSimctlDevices(stdout);
    } catch {
        return [];
    }
}

export async function discoverRuntimeDevices(): Promise<RuntimeDevice[]> {
    const [iosPhysical, iosSimulators] = await Promise.all([
        process.platform === 'darwin' ? discoverConnectedDevices().catch(() => []) : Promise.resolve([]),
        discoverIosSimulators(),
    ]);
    return [
        ...iosPhysical.map((device) => ({ ...device, platform: 'ios' as const, kind: 'physical' as const, automationBackend: 'wda' as const })),
        ...iosSimulators,
    ];
}

export async function registerRuntimeDevice(
    udid: string,
    options: { name?: string } = {},
): Promise<RegisteredDevice> {
    const runtime = (await discoverRuntimeDevices()).find((device) => device.udid === udid);
    if (!runtime) throw Object.assign(new Error('Runtime device is not currently discoverable on this worker'), { statusCode: 404 });
    if (runtime.kind === 'physical') {
        throw Object.assign(new Error('Physical iPhones use the guided WDA registration flow'), { statusCode: 409 });
    }
    let result!: RegisteredDevice;
    await mutateRegisteredDevices((devices) => {
        const existing = devices.find((device) => device.udid === runtime.udid);
        if (existing) {
            result = existing;
            return;
        }
        result = {
            name: options.name?.trim().slice(0, 100) || runtime.name,
            udid: runtime.udid,
            osVersion: runtime.osVersion,
            productType: runtime.productType,
            platform: runtime.platform,
            kind: runtime.kind,
            automationBackend: 'appium',
            pluginData: {},
        };
        devices.push(result);
    });
    return result;
}
