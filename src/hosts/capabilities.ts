import os from 'node:os';
import path from 'node:path';
import { access } from 'node:fs/promises';

export type HostCapability =
    | 'ios.physical'
    | 'ios.simulator'
    | 'appium'
    | 'wda'
    | 'simctl';

export interface HostSnapshot {
    id: string;
    hostname: string;
    os: NodeJS.Platform | 'unknown';
    arch: string;
    online: boolean;
    observedAt: string;
    error?: string;
    capabilities: HostCapability[];
    tools: {
        appium: boolean;
        appiumRuntime: boolean;
        xcrun: boolean;
    };
    metrics?: {
        uptimeSeconds: number;
        load1: number;
        cpuCount: number;
        totalMemoryBytes: number;
        freeMemoryBytes: number;
    };
}

async function exists(file: string): Promise<boolean> {
    try { await access(file); return true; } catch { return false; }
}

async function commandAvailable(command: string, envPath = process.env.PATH ?? ''): Promise<boolean> {
    for (const directory of envPath.split(path.delimiter).filter(Boolean)) {
        if (await exists(path.join(directory, command))) return true;
    }
    return false;
}

export async function detectHostCapabilities(options: {
    id?: string;
    hostname?: string;
    platform?: NodeJS.Platform;
    arch?: string;
    envPath?: string;
    appiumEntry?: string;
    appiumRuntimeEntry?: string;
    physicalIosEnabled?: boolean;
    commandAvailable?: (command: string) => Promise<boolean>;
} = {}): Promise<HostSnapshot> {
    const platform = options.platform ?? process.platform;
    const probe = options.commandAvailable ?? ((command: string) => commandAvailable(command, options.envPath));
    const [xcrun, appium, appiumRuntime] = await Promise.all([
        probe('xcrun'),
        exists(options.appiumEntry ?? path.resolve('node_modules/appium/index.js')),
        exists(options.appiumRuntimeEntry ?? path.resolve('node_modules/appium-runtime/index.js')),
    ]);
    const capabilities: HostCapability[] = [];
    const physicalIosEnabled = options.physicalIosEnabled ?? process.env.PHONE_FARM_ENABLE_PHYSICAL_IOS !== 'false';
    if (appium || appiumRuntime) capabilities.push('appium');
    if (xcrun) capabilities.push('simctl');
    if (platform === 'darwin') {
        if (physicalIosEnabled) capabilities.push('ios.physical');
        if (xcrun) capabilities.push('ios.simulator');
        if (physicalIosEnabled && xcrun && appium) capabilities.push('wda');
    }
    return {
        id: options.id ?? process.env.PHONE_FARM_WORKER_ID ?? 'local',
        hostname: options.hostname ?? os.hostname(),
        os: platform,
        arch: options.arch ?? process.arch,
        online: true,
        observedAt: new Date().toISOString(),
        capabilities,
        tools: { appium, appiumRuntime, xcrun },
        metrics: {
            uptimeSeconds: Math.max(0, Math.round(os.uptime())),
            load1: Number((os.loadavg()[0] ?? 0).toFixed(2)),
            cpuCount: os.cpus().length,
            totalMemoryBytes: os.totalmem(),
            freeMemoryBytes: os.freemem(),
        },
    };
}
