export {};

declare global {
    interface Window {
        htmx?: { ajax(method: string, url: string, options: { target: string; swap: string }): unknown };
    }
}

const search = document.querySelector<HTMLInputElement>('#device-list-search')!;
const statusFilter = document.querySelector<HTMLSelectElement>('#device-list-status')!;
const platformFilter = document.querySelector<HTMLSelectElement>('#device-list-platform')!;
const reset = document.querySelector<HTMLButtonElement>('#device-list-reset')!;
const summary = document.querySelector<HTMLElement>('#device-list-summary')!;
const actionStatus = document.querySelector<HTMLElement>('#device-list-action-status')!;
const filterEmpty = document.querySelector<HTMLElement>('#device-filter-empty')!;
const filterEmptyReset = document.querySelector<HTMLButtonElement>('#device-filter-empty-reset')!;
const dialog = document.querySelector<HTMLDialogElement>('#overview-rename-dialog')!;
const form = document.querySelector<HTMLFormElement>('#overview-rename-form')!;
const input = document.querySelector<HTMLInputElement>('#overview-rename-name')!;
const result = document.querySelector<HTMLElement>('#overview-rename-result')!;
const close = document.querySelector<HTMLButtonElement>('#overview-rename-close')!;
let renameUdid = '';

function refreshDevices(): void {
    actionStatus.textContent = '';
    if (window.htmx) {
        window.htmx.ajax('GET', '/api/fragments/devices', { target: '#device-list', swap: 'outerHTML' });
        return;
    }
    location.reload();
}

function clearFilters(): void {
    search.value = '';
    statusFilter.value = '';
    platformFilter.value = '';
    applyFilters();
    search.focus();
}

function applyFilters(): void {
    const list = document.querySelector<HTMLElement>('#device-list');
    if (!list) return;
    const query = search.value.trim().toLowerCase();
    const wantedStatus = statusFilter.value;
    const wantedPlatform = platformFilter.value;
    const entries = Array.from(list.querySelectorAll<HTMLElement>('[data-device-entry]'));
    let shown = 0;
    let shownDisabled = 0;
    for (const entry of entries) {
        const matchesQuery = !query || (entry.dataset.search ?? '').includes(query);
        const matchesStatus = !wantedStatus || entry.dataset.status === wantedStatus;
        const matchesPlatform = !wantedPlatform || entry.dataset.platform === wantedPlatform;
        const visible = matchesQuery && matchesStatus && matchesPlatform;
        entry.hidden = !visible;
        if (visible) {
            shown += 1;
            if (entry.dataset.status === 'disabled') shownDisabled += 1;
        }
    }
    const disabledPanel = list.querySelector<HTMLDetailsElement>('.disabled-devices');
    if (disabledPanel) {
        disabledPanel.hidden = shownDisabled === 0;
        if (shownDisabled && (query || wantedStatus === 'disabled' || wantedPlatform)) disabledPanel.open = true;
    }
    const baseEmpty = list.querySelector<HTMLElement>('[data-device-base-empty]');
    if (baseEmpty) baseEmpty.hidden = Boolean(query || wantedStatus || wantedPlatform);
    const filtered = entries.length > 0 && shown === 0;
    filterEmpty.hidden = !filtered;
    summary.textContent = entries.length
        ? (shown === entries.length ? `${entries.length} device${entries.length === 1 ? '' : 's'}` : `${shown} shown · ${entries.length} total`)
        : '0 devices';
}

async function patchDevice(udid: string, body: Record<string, unknown>): Promise<void> {
    const response = await fetch(`/api/devices/${encodeURIComponent(udid)}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? `Request failed (${response.status})`);
    }
}

document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const rename = target?.closest<HTMLButtonElement>('[data-rename-device]');
    if (rename) {
        event.preventDefault();
        const root = rename.closest('.device-card, li') ?? rename.parentElement;
        renameUdid = rename.dataset.renameDevice ?? '';
        input.value = (root?.querySelector('.device-name')?.textContent ?? '').replace(/\s+/g, ' ').trim();
        result.textContent = '';
        dialog.showModal();
        input.focus();
        input.select();
        return;
    }
    const toggle = target?.closest<HTMLButtonElement>('[data-toggle-device]');
    if (!toggle) return;
    event.preventDefault();
    toggle.disabled = true;
    actionStatus.textContent = toggle.dataset.disabled === 'true' ? 'Disconnecting…' : 'Reconnecting…';
    void patchDevice(toggle.dataset.toggleDevice ?? '', { disabled: toggle.dataset.disabled === 'true' })
        .then(refreshDevices)
        .catch((error) => {
            toggle.disabled = false;
            actionStatus.textContent = error instanceof Error ? error.message : String(error);
        });
});

close.addEventListener('click', () => dialog.close());
form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = input.value.replace(/\s+/g, ' ').trim();
    if (!renameUdid || !name) { result.textContent = 'Device name is required.'; return; }
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.disabled = true;
    result.textContent = 'Saving…';
    void patchDevice(renameUdid, { name })
        .then(() => { dialog.close(); refreshDevices(); })
        .catch((error) => { result.textContent = error instanceof Error ? error.message : String(error); })
        .finally(() => { submit.disabled = false; });
});

search.addEventListener('input', applyFilters);
statusFilter.addEventListener('change', applyFilters);
platformFilter.addEventListener('change', applyFilters);
reset.addEventListener('click', clearFilters);
filterEmptyReset.addEventListener('click', clearFilters);
document.body.addEventListener('htmx:afterSwap', (event) => {
    const detailTarget = (event as CustomEvent<{ target?: Element }>).detail?.target;
    const target = detailTarget ?? (event.target instanceof Element ? event.target : undefined);
    if (target?.id === 'device-list') applyFilters();
});
applyFilters();
