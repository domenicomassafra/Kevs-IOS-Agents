import type { DeviceConnectionStatus } from './devices/connection-manager.js';
import type { Device } from './devices/discovery.js';
import { loadRegisteredDevices, mutateRegisteredDevices, type RegisteredDevice } from './devices/registry.js';
import type { RemoteAction, RemoteControl, ScreenInfo } from './devices/wda-remote.js';

export interface DeviceWorkerDescriptor {
    id: string;
    url: URL;
    token?: string;
}

export interface DeviceWorkerDevice {
    registered: Omit<RegisteredDevice, 'passcode'> & { hasPasscode: boolean };
    connected: Device | null;
    status?: DeviceConnectionStatus;
}

export function configuredDeviceWorkers(
    value = process.env.PHONE_FARM_DEVICE_WORKERS ?? '',
    token = process.env.PHONE_FARM_DEVICE_WORKER_TOKEN,
): DeviceWorkerDescriptor[] {
    if (!value.trim()) return [];
    const seen = new Set<string>();
    return value.split(',').map((entry) => {
        const separator = entry.indexOf('=');
        if (separator <= 0) throw new Error('PHONE_FARM_DEVICE_WORKERS must use id=http(s)://host:port entries');
        const id = entry.slice(0, separator).trim();
        const rawUrl = entry.slice(separator + 1).trim();
        if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(id)) throw new Error(`Invalid device worker id: ${id}`);
        if (seen.has(id)) throw new Error(`Duplicate device worker id: ${id}`);
        seen.add(id);
        const url = new URL(rawUrl);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
            throw new Error(`Invalid URL for device worker ${id}`);
        }
        url.pathname = url.pathname.replace(/\/+$/, '') || '/';
        return { id, url, ...(token ? { token } : {}) };
    });
}

export class DeviceWorkerClient {
    constructor(
        readonly descriptor: DeviceWorkerDescriptor,
        private readonly fetchImpl: typeof fetch = fetch,
    ) {}

    private url(pathname: string): URL {
        return new URL(pathname.replace(/^\//, ''), this.descriptor.url.href.endsWith('/') ? this.descriptor.url : new URL(`${this.descriptor.url.href}/`));
    }

    private async request(pathname: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<Response> {
        const headers = new Headers(init.headers);
        if (this.descriptor.token) headers.set('authorization', `Bearer ${this.descriptor.token}`);
        const response = await this.fetchImpl(this.url(pathname), {
            ...init,
            headers,
            signal: init.signal
                ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)])
                : AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) {
            const detail = (await response.text()).slice(0, 500);
            throw new Error(`Device worker ${this.descriptor.id} returned ${response.status}${detail ? `: ${detail}` : ''}`);
        }
        return response;
    }

    async devices(): Promise<DeviceWorkerDevice[]> {
        const response = await this.request('/v1/devices');
        return (await response.json() as { devices: DeviceWorkerDevice[] }).devices;
    }

    async getScreenInfo(udid: string): Promise<ScreenInfo> {
        return await (await this.request(`/v1/devices/${encodeURIComponent(udid)}/info`)).json() as ScreenInfo;
    }

    async getAccessibilityTree(udid: string): Promise<unknown> {
        return await (await this.request(`/v1/devices/${encodeURIComponent(udid)}/source`, {}, 50_000)).json();
    }

    async getScreenshot(udid: string): Promise<Buffer> {
        const response = await this.request(`/v1/devices/${encodeURIComponent(udid)}/screenshot`);
        return Buffer.from(await response.arrayBuffer());
    }

    async getMjpegStream(udid: string, signal?: AbortSignal): Promise<Response> {
        return this.request(`/v1/devices/${encodeURIComponent(udid)}/stream`, { signal }, 20_000);
    }

    async performAction(udid: string, action: RemoteAction): Promise<void> {
        await this.request(`/v1/devices/${encodeURIComponent(udid)}/action`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(action),
        });
    }

    async isLocked(udid: string): Promise<boolean> {
        const body = await (await this.request(`/v1/devices/${encodeURIComponent(udid)}/locked`)).json() as { locked: boolean };
        return body.locked;
    }

    async connection(udid: string): Promise<DeviceConnectionStatus> {
        return await (await this.request(`/v1/devices/${encodeURIComponent(udid)}/connection`)).json() as DeviceConnectionStatus;
    }

    async reconnect(udid: string): Promise<DeviceConnectionStatus | undefined> {
        const response = await this.request(`/v1/devices/${encodeURIComponent(udid)}/reconnect`, { method: 'POST' });
        return await response.json() as DeviceConnectionStatus | undefined;
    }

    async updateConfig(device: RegisteredDevice): Promise<void> {
        const body = {
            name: device.name,
            ...(device.coordinateProfile ? { coordinateProfile: device.coordinateProfile } : {}),
            ...(device.coordinates ? { coordinates: device.coordinates } : {}),
            ...(device.instagramCoordinates ? { instagramCoordinates: device.instagramCoordinates } : {}),
            ...(device.disabled === true ? { disabled: true } : { disabled: false }),
            pluginData: device.pluginData,
        };
        await this.request(`/v1/devices/${encodeURIComponent(device.udid)}/config`, {
            method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
        });
    }
}

export class DeviceWorkerFleet implements RemoteControl {
    private readonly clients: Map<string, DeviceWorkerClient>;
    private readonly ownership = new Map<string, string>();
    private snapshots: DeviceWorkerDevice[] = [];

    constructor(descriptors: readonly DeviceWorkerDescriptor[], fetchImpl: typeof fetch = fetch) {
        this.clients = new Map(descriptors.map((descriptor) => [descriptor.id, new DeviceWorkerClient(descriptor, fetchImpl)]));
    }

    async refresh(): Promise<DeviceWorkerDevice[]> {
        const batches = await Promise.all(Array.from(this.clients.entries(), async ([id, client]) => {
            try {
                return { id, devices: await client.devices() };
            } catch (error) {
                console.warn(`Device worker ${id} is unavailable: ${error instanceof Error ? error.message : String(error)}`);
                return { id, devices: [] as DeviceWorkerDevice[] };
            }
        }));
        const ownership = new Map<string, string>();
        const snapshots: DeviceWorkerDevice[] = [];
        for (const batch of batches) {
            for (const snapshot of batch.devices) {
                const previous = ownership.get(snapshot.registered.udid);
                if (previous && previous !== batch.id) {
                    throw new Error(`Device ${snapshot.registered.udid} is advertised by both ${previous} and ${batch.id}`);
                }
                ownership.set(snapshot.registered.udid, batch.id);
                snapshots.push(snapshot);
            }
        }
        await mutateRegisteredDevices((registered) => {
            for (const snapshot of snapshots) {
                const workerId = ownership.get(snapshot.registered.udid)!;
                const existing = registered.find(({ udid }) => udid === snapshot.registered.udid);
                if (existing) {
                    existing.workerId = workerId;
                    existing.name = snapshot.registered.name;
                    if (!existing.coordinateProfile && snapshot.registered.coordinateProfile) existing.coordinateProfile = snapshot.registered.coordinateProfile;
                    continue;
                }
                registered.push({
                    name: snapshot.registered.name,
                    udid: snapshot.registered.udid,
                    workerId,
                    ...(snapshot.registered.coordinateProfile ? { coordinateProfile: snapshot.registered.coordinateProfile } : {}),
                    ...(snapshot.registered.coordinates ? { coordinates: snapshot.registered.coordinates } : {}),
                    ...(snapshot.registered.instagramCoordinates ? { instagramCoordinates: snapshot.registered.instagramCoordinates } : {}),
                    pluginData: snapshot.registered.pluginData ?? {},
                });
            }
        });
        this.ownership.clear();
        for (const [udid, id] of ownership) this.ownership.set(udid, id);
        this.snapshots = snapshots;
        const authoritative = await loadRegisteredDevices();
        const syncResults = await Promise.allSettled(authoritative
            .filter(({ workerId }) => Boolean(workerId) && this.clients.has(workerId!))
            .map((device) => this.syncDeviceConfiguration(device)));
        syncResults.forEach((result) => {
            if (result.status === 'rejected') {
                console.warn(`Device-worker configuration sync failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
            }
        });
        return snapshots;
    }

    async discoverDevices(): Promise<Device[]> {
        return this.snapshots.flatMap(({ connected }) => connected ? [connected] : []);
    }

    forget(udid: string): void { this.ownership.delete(udid); }

    private async clientFor(udid: string): Promise<DeviceWorkerClient> {
        let workerId = this.ownership.get(udid);
        if (!workerId) workerId = (await loadRegisteredDevices()).find((device) => device.udid === udid)?.workerId;
        const client = workerId ? this.clients.get(workerId) : undefined;
        if (!client) throw new Error(`No device worker is configured for ${udid}`);
        return client;
    }

    async getScreenInfo(udid: string): Promise<ScreenInfo> { return (await this.clientFor(udid)).getScreenInfo(udid); }
    async getAccessibilityTree(udid: string): Promise<unknown> { return (await this.clientFor(udid)).getAccessibilityTree(udid); }
    async getScreenshot(udid: string): Promise<Buffer> { return (await this.clientFor(udid)).getScreenshot(udid); }
    async getMjpegStream(udid: string, signal?: AbortSignal): Promise<Response> { return (await this.clientFor(udid)).getMjpegStream(udid, signal); }
    async performAction(udid: string, action: RemoteAction): Promise<void> { return (await this.clientFor(udid)).performAction(udid, action); }
    async isLocked(udid: string): Promise<boolean> { return (await this.clientFor(udid)).isLocked(udid); }
    async connectionStatus(udid: string): Promise<DeviceConnectionStatus> { return (await this.clientFor(udid)).connection(udid); }
    async reconnectDevice(udid: string): Promise<DeviceConnectionStatus | undefined> { return (await this.clientFor(udid)).reconnect(udid); }
    async syncDeviceConfiguration(device: RegisteredDevice): Promise<void> {
        if (!device.workerId) return;
        const client = this.clients.get(device.workerId);
        if (!client) throw new Error(`No device worker named ${device.workerId} is configured`);
        await client.updateConfig(device);
    }
}
