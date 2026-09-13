export {};

interface ConnectedDevice { udid: string; osVersion?: string }
interface FleetDevice {
    udid: string;
    name: string;
    platform?: 'ios' | 'android';
    kind?: 'physical' | 'simulator' | 'emulator';
    workerId?: string;
    disabled?: boolean;
    connected: ConnectedDevice | null;
}
interface Execution { deviceUdid: string; status: string; taskType: string; pluginId: string }

const grid = document.querySelector<HTMLElement>('#fleet-grid')!;
const count = document.querySelector<HTMLElement>('#fleet-visible-count')!;
const refresh = document.querySelector<HTMLButtonElement>('#fleet-refresh')!;
const focus = document.querySelector<HTMLElement>('#fleet-focus')!;
const focusName = document.querySelector<HTMLElement>('#fleet-focus-name')!;
const focusMeta = document.querySelector<HTMLElement>('#fleet-focus-meta')!;
const focusScreen = document.querySelector<HTMLImageElement>('#fleet-focus-screen')!;
const focusStatus = document.querySelector<HTMLElement>('#fleet-focus-status')!;
const focusOpen = document.querySelector<HTMLAnchorElement>('#fleet-focus-open')!;
const focusClose = document.querySelector<HTMLButtonElement>('#fleet-focus-close')!;
const filters = Array.from(document.querySelectorAll<HTMLButtonElement>('.fleet-filter[data-filter]'));
const stats = {
    total: document.querySelector<HTMLElement>('#fleet-total')!,
    online: document.querySelector<HTMLElement>('#fleet-online')!,
    physical: document.querySelector<HTMLElement>('#fleet-physical')!,
    virtual: document.querySelector<HTMLElement>('#fleet-virtual')!,
};

let devices: FleetDevice[] = [];
let running = new Map<string, Execution>();
let activeFilter = 'all';
let focusedUdid = '';
let focusFallbackActive = false;

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character] ?? character));
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const body = await response.json().catch(() => ({})) as T & { error?: string };
    if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
    return body;
}

function matches(device: FleetDevice): boolean {
    const platform = device.platform ?? 'ios';
    const kind = device.kind ?? 'physical';
    if (activeFilter === 'all') return true;
    if (activeFilter === 'online') return Boolean(device.connected) && !device.disabled;
    if (activeFilter === 'ios' || activeFilter === 'android') return platform === activeFilter;
    if (activeFilter === 'physical') return kind === 'physical';
    if (activeFilter === 'virtual') return kind !== 'physical';
    if (activeFilter === 'running') return running.has(device.udid);
    return true;
}

function screenshotUrl(udid: string): string {
    return `/api/devices/${encodeURIComponent(udid)}/remote/screenshot?t=${Date.now()}`;
}

function tile(device: FleetDevice): string {
    const platform = device.platform ?? 'ios';
    const kind = device.kind ?? 'physical';
    const online = Boolean(device.connected) && !device.disabled;
    const execution = running.get(device.udid);
    const worker = device.workerId ? ` · ${escapeHtml(device.workerId)}` : '';
    const preview = online
        ? `<img class="fleet-live-preview" src="${screenshotUrl(device.udid)}" alt="Screen of ${escapeHtml(device.name)}" draggable="false">`
        : '<div class="mock-screen mock-offline"><div class="mock-offline-mark"></div><span class="mock-offline-label">Offline</span></div>';
    return `<article class="fleet-tile${focusedUdid === device.udid ? ' is-focused' : ''}" data-udid="${escapeHtml(device.udid)}" data-online="${online}">
        <button class="fleet-tile-focus" type="button" data-focus="${escapeHtml(device.udid)}" ${online ? '' : 'disabled'}>
            <div class="fleet-phone"><div class="fleet-bezel">${preview}</div></div>
        </button>
        <div class="fleet-copy"><h2>${escapeHtml(device.name)}</h2><p>${escapeHtml(platform)} · ${escapeHtml(kind)}${device.connected?.osVersion ? ` · ${escapeHtml(device.connected.osVersion)}` : ''}${worker}</p>
            <div class="fleet-chips"><span class="connection-chip ${online ? 'ready' : 'unavailable'}">${online ? 'Online' : 'Offline'}</span>${execution ? `<span class="connection-chip running">${escapeHtml(execution.taskType)}</span>` : '<span class="connection-chip">Idle</span>'}</div>
        </div>
        <a class="button secondary fleet-open" href="/devices/${encodeURIComponent(device.udid)}">Open →</a>
    </article>`;
}

function render(): void {
    const visible = devices.filter(matches);
    stats.total.textContent = String(devices.length);
    stats.online.textContent = String(devices.filter((device) => Boolean(device.connected) && !device.disabled).length);
    stats.physical.textContent = String(devices.filter((device) => (device.kind ?? 'physical') === 'physical').length);
    stats.virtual.textContent = String(devices.filter((device) => (device.kind ?? 'physical') !== 'physical').length);
    count.textContent = `Showing ${visible.length} of ${devices.length}`;
    grid.innerHTML = visible.length ? visible.map(tile).join('')
        : '<div class="empty-state"><h2>No devices match this filter</h2><p>Change the filter or start a runtime from the Devices page.</p></div>';
}

async function load(): Promise<void> {
    refresh.disabled = true;
    try {
        const [deviceRows, executionRows] = await Promise.all([
            json<FleetDevice[]>('/api/devices'),
            json<{ executions: Execution[] }>('/api/executions'),
        ]);
        devices = deviceRows;
        running = new Map(executionRows.executions.filter(({ status }) => status === 'running')
            .map((execution) => [execution.deviceUdid, execution]));
        render();
    } finally {
        refresh.disabled = false;
    }
}

async function liveStreamUrl(udid: string): Promise<string> {
    const result = await json<{ url: string }>(`/api/devices/${encodeURIComponent(udid)}/remote/stream-token`, { method: 'POST' });
    return result.url;
}

async function focusDevice(udid: string): Promise<void> {
    const device = devices.find((candidate) => candidate.udid === udid);
    if (!device?.connected) return;
    focusedUdid = udid;
    render();
    focus.hidden = false;
    focusName.textContent = device.name;
    focusMeta.textContent = `${device.platform ?? 'ios'} · ${device.kind ?? 'physical'}${device.workerId ? ` · ${device.workerId}` : ''}`;
    focusOpen.href = `/devices/${encodeURIComponent(udid)}`;
    focusStatus.textContent = 'Connecting live stream…';
    focusFallbackActive = false;
    focusScreen.removeAttribute('src');
    try {
        focusScreen.src = await liveStreamUrl(udid);
        focusStatus.textContent = 'Live · only this focused device is streaming';
    } catch (error) {
        focusScreen.src = screenshotUrl(udid);
        focusStatus.textContent = error instanceof Error ? `${error.message} · still preview` : 'Live unavailable · still preview';
    }
}

grid.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-focus]');
    if (button?.dataset.focus) void focusDevice(button.dataset.focus);
});
filters.forEach((button) => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter ?? 'all';
    filters.forEach((candidate) => candidate.classList.toggle('is-active', candidate === button));
    render();
}));
refresh.addEventListener('click', () => void load());
focusClose.addEventListener('click', () => {
    focusedUdid = '';
    focusFallbackActive = false;
    focusScreen.removeAttribute('src');
    focus.hidden = true;
    render();
});
focusScreen.addEventListener('error', () => {
    if (!focusedUdid) return;
    if (focusFallbackActive) {
        focusScreen.removeAttribute('src');
        focusStatus.textContent = 'Device preview unavailable';
        return;
    }
    focusFallbackActive = true;
    focusScreen.src = screenshotUrl(focusedUdid);
    focusStatus.textContent = 'Stream interrupted · showing still preview';
});

void load();
window.setInterval(() => void load().catch(() => undefined), 8_000);
