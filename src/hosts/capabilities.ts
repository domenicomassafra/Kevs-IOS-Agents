import os from 'node:os';
import path from 'node:path';
import { access } from 'node:fs/promises';

export type HostCapability =
    | 'ios.physical'
    | 'ios.simulator'
    | 'android.physical'
    | 'android.emulator'
    | 'appium'
    | 'wda'
    | 'simctl'
    | 'adb';

export interface HostSnapshot {
    id: string;
    hostname: string;
    os: NodeJS.Platform;
    arch: string;
    capabilities: HostCapability[];
    tools: {
        appium: boolean;
        appiumRuntime: boolean;
        xcrun: boolean;
        adb: boolean;
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
    commandAvailable?: (command: string) => Promise<boolean>;
} = {}): Promise<HostSnapshot> {
    const platform = options.platform ?? process.platform;
    const probe = options.commandAvailable ?? ((command: string) => commandAvailable(command, options.envPath));
    const [xcrun, adb, appium, appiumRuntime] = await Promise.all([
        probe('xcrun'),
        probe('adb'),
        exists(options.appiumEntry ?? path.resolve('node_modules/appium/index.js')),
        exists(options.appiumRuntimeEntry ?? path.resolve('node_modules/appium-runtime/index.js')),
    ]);
    const capabilities: HostCapability[] = [];
    if (appium || appiumRuntime) capabilities.push('appium');
    if (xcrun) capabilities.push('simctl');
    if (adb) capabilities.push('adb');
    if (platform === 'darwin') {
        capabilities.push('ios.physical');
        if (xcrun) capabilities.push('ios.simulator');
        if (xcrun && appium) capabilities.push('wda');
    }
    if (adb) capabilities.push('android.physical', 'android.emulator');
    return {
        id: options.id ?? process.env.PHONE_FARM_WORKER_ID ?? 'local',
        hostname: options.hostname ?? os.hostname(),
        os: platform,
        arch: options.arch ?? process.arch,
        capabilities,
        tools: { appium, appiumRuntime, xcrun, adb },
    };
}
