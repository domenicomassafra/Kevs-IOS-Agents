export {};

interface ConnectedDevice { udid: string; osVersion?: string }
interface FleetDevice {
    udid: string;
    name: string;
    platform?: 'ios' | 'android';
    kind?: 'physical' | 'simulator' | 'emulator';
    workerId?: string;
    tags?: string[];
    disabled?: boolean;
    connected: ConnectedDevice | null;
}
interface Execution { deviceUdid: string; status: string; taskType: string; pluginId: string }

const grid = document.querySelector<HTMLElement>('#fleet-grid')!;
const count = document.querySelector<HTMLElement>('#fleet-visible-count')!;
const refresh = document.querySelector<HTMLButtonElement>('#fleet-refresh')!;
const search = document.querySelector<HTMLInputElement>('#fleet-search')!;
const groupBy = document.querySelector<HTMLSelectElement>('#fleet-group')!;
const bulk = document.querySelector<HTMLElement>('#fleet-bulk')!;
const selectedCount = document.querySelector<HTMLElement>('#fleet-selected-count')!;
const selectVisible = document.querySelector<HTMLButtonElement>('#fleet-select-visible')!;
const clearSelection = document.querySelector<HTMLButtonElement>('#fleet-clear-selection')!;
const bulkAction = document.querySelector<HTMLSelectElement>('#fleet-bulk-action')!;
const bulkApply = document.querySelector<HTMLButtonElement>('#fleet-bulk-apply')!;
const bulkStatus = document.querySelector<HTMLElement>('#fleet-bulk-status')!;
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
let grouping: 'none' | 'host' | 'platform' | 'kind' = 'none';
const selected = new Set<string>();

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
    const filterMatch = activeFilter === 'all'
        || (activeFilter === 'online' && Boolean(device.connected) && !device.disabled)
        || ((activeFilter === 'ios' || activeFilter === 'android') && platform === activeFilter)
        || (activeFilter === 'physical' && kind === 'physical')
        || (activeFilter === 'virtual' && kind !== 'physical')
        || (activeFilter === 'running' && running.has(device.udid));
    if (!filterMatch) return false;
    const query = search.value.trim().toLowerCase();
    if (!query) return true;
    return [device.name, device.udid, device.workerId ?? '', platform, kind, ...(device.tags ?? [])]
        .some((value) => value.toLowerCase().includes(query));
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
    const tags = (device.tags ?? []).map((tag) => `<span class="connection-chip tag">#${escapeHtml(tag)}</span>`).join('');
    const preview = online
        ? `<img class="fleet-live-preview" src="${screenshotUrl(device.udid)}" alt="Screen of ${escapeHtml(device.name)}" draggable="false">`
        : '<div class="mock-screen mock-offline"><div class="mock-offline-mark"></div><span class="mock-offline-label">Offline</span></div>';
    return `<article class="fleet-tile${focusedUdid === device.udid ? ' is-focused' : ''}${selected.has(device.udid) ? ' is-selected' : ''}" data-udid="${escapeHtml(device.udid)}" data-online="${online}">
        <label class="fleet-select"><input type="checkbox" data-select="${escapeHtml(device.udid)}" ${selected.has(device.udid) ? 'checked' : ''}><span>Select</span></label>
        <button class="fleet-tile-focus" type="button" data-focus="${escapeHtml(device.udid)}" ${online ? '' : 'disabled'}>
            <div class="fleet-phone"><div class="fleet-bezel">${preview}</div></div>
        </button>
        <div class="fleet-copy"><h2>${escapeHtml(device.name)}</h2><p>${escapeHtml(platform)} · ${escapeHtml(kind)}${device.connected?.osVersion ? ` · ${escapeHtml(device.connected.osVersion)}` : ''}${worker}</p>
            <div class="fleet-chips"><span class="connection-chip ${online ? 'ready' : 'unavailable'}">${online ? 'Online' : 'Offline'}</span>${execution ? `<span class="connection-chip running">${escapeHtml(execution.taskType)}</span>` : '<span class="connection-chip">Idle</span>'}${tags}</div>
        </div>
        <a class="button secondary fleet-open" href="/devices/${encodeURIComponent(device.udid)}">Open →</a>
    </article>`;
}

function groupKey(device: FleetDevice): string {
    if (grouping === 'host') return device.workerId || 'Local / unassigned';
    if (grouping === 'platform') return device.platform ?? 'ios';
    if (grouping === 'kind') return device.kind ?? 'physical';
    return '';
}

function groupedHtml(visible: FleetDevice[]): string {
    if (grouping === 'none') return visible.map(tile).join('');
    const groups = new Map<string, FleetDevice[]>();
    for (const device of visible) {
        const key = groupKey(device);
        groups.set(key, [...(groups.get(key) ?? []), device]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, rows]) => `
        <section class="fleet-group">
            <div class="fleet-group-heading"><div><span class="eyebrow">${escapeHtml(grouping)}</span><h2>${escapeHtml(label)}</h2></div><span>${rows.length} device${rows.length === 1 ? '' : 's'}</span></div>
            <div class="fleet-grid fleet-grid-group">${rows.map(tile).join('')}</div>
        </section>`).join('');
}

function updateBulkBar(): void {
    bulk.hidden = selected.size === 0;
    selectedCount.textContent = `${selected.size} selected`;
}

function render(): void {
    const visible = devices.filter(matches);
    stats.total.textContent = String(devices.length);
    stats.online.textContent = String(devices.filter((device) => Boolean(device.connected) && !device.disabled).length);
    stats.physical.textContent = String(devices.filter((device) => (device.kind ?? 'physical') === 'physical').length);
    stats.virtual.textContent = String(devices.filter((device) => (device.kind ?? 'physical') !== 'physical').length);
    count.textContent = `Showing ${visible.length} of ${devices.length}`;
    for (const udid of [...selected]) if (!devices.some((device) => device.udid === udid)) selected.delete(udid);
    grid.innerHTML = visible.length ? groupedHtml(visible)
        : '<div class="empty-state"><h2>No devices match this filter</h2><p>Change the filter or start a runtime from the Devices page.</p></div>';
    updateBulkBar();
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
    focusMeta.textContent = `${device.platform ?? 'ios'} · ${device.kind ?? 'physical'}${device.workerId ? ` · ${device.workerId}` : ''}${device.tags?.length ? ` · ${device.tags.map((tag) => `#${tag}`).join(' ')}` : ''}`;
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
    const selector = (event.target as Element).closest<HTMLInputElement>('[data-select]');
    if (selector?.dataset.select) {
        if (selector.checked) selected.add(selector.dataset.select);
        else selected.delete(selector.dataset.select);
        updateBulkBar();
        selector.closest('.fleet-tile')?.classList.toggle('is-selected', selector.checked);
        return;
    }
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-focus]');
    if (button?.dataset.focus) void focusDevice(button.dataset.focus);
});
filters.forEach((button) => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter ?? 'all';
    filters.forEach((candidate) => candidate.classList.toggle('is-active', candidate === button));
    render();
}));
refresh.addEventListener('click', () => void load());
search.addEventListener('input', render);
groupBy.addEventListener('change', () => {
    grouping = groupBy.value as typeof grouping;
    render();
});
selectVisible.addEventListener('click', () => {
    devices.filter(matches).forEach((device) => selected.add(device.udid));
    render();
});
clearSelection.addEventListener('click', () => {
    selected.clear();
    bulkStatus.textContent = '';
    render();
});
bulkApply.addEventListener('click', async () => {
    const action = bulkAction.value as 'enable' | 'disable' | 'reconnect' | 'clear-queue' | '';
    if (!action || !selected.size) return;
    if ((action === 'disable' || action === 'clear-queue') && !window.confirm(`${action === 'disable' ? 'Disable' : 'Clear queues on'} ${selected.size} selected devices?`)) return;
    bulkApply.disabled = true;
    bulkStatus.textContent = 'Applying…';
    try {
        const result = await json<{ ok: boolean; affected?: number; results?: Array<{ ok: boolean; message: string }> }>('/api/fleet/actions', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ deviceUdids: [...selected], action }),
        });
        const failed = result.results?.filter(({ ok }) => !ok).length ?? 0;
        bulkStatus.textContent = failed ? `Completed with ${failed} failures.` : `Applied ${action} to ${selected.size} devices.`;
        if (action === 'disable') selected.clear();
        await load();
    } catch (error) {
        bulkStatus.textContent = error instanceof Error ? error.message : String(error);
    } finally {
        bulkApply.disabled = false;
    }
});
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
