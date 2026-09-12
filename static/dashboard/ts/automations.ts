export {};

interface DeviceRow {
    udid: string;
    name: string;
    disabled?: boolean;
}

interface PipelineItem {
    id: string;
    status: string;
    caption: string | null;
    assetName: string | null;
    mimeType: string | null;
    error: string | null;
    createdAt: string;
    publishedAt: string | null;
}

interface PipelineState {
    enabled: boolean;
    frequency?: string;
    frequencyLabel?: string;
    checkTimes: Array<{ localTime?: string; timezone?: string; everyMinutes?: number; label?: string }>;
    items: PipelineItem[];
}

const params = new URLSearchParams(location.search);
const elements = {
    templates: Array.from(document.querySelectorAll<HTMLButtonElement>('.automation-template[data-template]')),
    workspace: document.querySelector<HTMLElement>('#pipeline-workspace')!,
    device: document.querySelector<HTMLSelectElement>('#pipeline-device')!,
    form: document.querySelector<HTMLFormElement>('#pipeline-form')!,
    video: document.querySelector<HTMLInputElement>('#pipeline-video')!,
    caption: document.querySelector<HTMLTextAreaElement>('#pipeline-caption')!,
    addResult: document.querySelector<HTMLElement>('#pipeline-add-result')!,
    auto: document.querySelector<HTMLInputElement>('#pipeline-auto')!,
    frequency: document.querySelector<HTMLSelectElement>('#pipeline-frequency')!,
    checkNow: document.querySelector<HTMLButtonElement>('#pipeline-check-now')!,
    refresh: document.querySelector<HTMLButtonElement>('#pipeline-refresh')!,
    status: document.querySelector<HTMLElement>('#pipeline-status')!,
    list: document.querySelector<HTMLElement>('#pipeline-list')!,
};

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

async function jsonRequest(url: string, init?: RequestInit): Promise<unknown> {
    const response = await fetch(url, init);
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
    return body;
}

function selectTemplate(id: string, options: { refresh?: boolean } = {}): void {
    for (const button of elements.templates) {
        const active = button.dataset.template === id;
        button.setAttribute('aria-pressed', String(active));
        button.classList.toggle('is-active', active);
    }
    elements.workspace.hidden = id !== 'pipeline';
    if (id === 'pipeline') {
        const next = new URL(location.href);
        next.searchParams.set('template', 'pipeline');
        history.replaceState(null, '', next);
        if (options.refresh !== false) void refreshPipeline();
    }
}

async function loadDevices(): Promise<void> {
    const devices = await jsonRequest('/api/devices') as DeviceRow[];
    const preferred = params.get('device') ?? '';
    elements.device.innerHTML = '<option value="">Select an iPhone…</option>';
    for (const device of devices.filter((entry) => !entry.disabled)) {
        elements.device.add(new Option(device.name, device.udid));
    }
    if (preferred && [...elements.device.options].some((option) => option.value === preferred)) {
        elements.device.value = preferred;
    }
}

function statusLabel(status: string): string {
    if (status === 'ready') return 'Ready';
    if (status === 'publishing') return 'Publishing';
    if (status === 'published') return 'Published';
    if (status === 'failed') return 'Failed';
    return status;
}

function renderItems(items: PipelineItem[]): void {
    elements.list.classList.remove('loading-card');
    elements.list.innerHTML = '';
    if (items.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state-inline';
        empty.textContent = 'Queue is empty. Add a video + caption above.';
        elements.list.append(empty);
        return;
    }
    for (const item of items) {
        const row = document.createElement('article');
        row.className = 'pipeline-item';
        const title = item.caption?.trim() || '(no caption)';
        const media = item.assetName ?? 'Published media removed';
        row.innerHTML = `
            <div>
                <strong>${escapeHtml(title)}</strong>
                <div class="run-meta">${escapeHtml(media)} · ${escapeHtml(statusLabel(item.status))} · ${new Date(item.createdAt).toLocaleString()}</div>
                ${item.error ? `<div class="run-error">${escapeHtml(item.error)}</div>` : ''}
            </div>
        `;
        if (item.status === 'ready' || item.status === 'failed') {
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'button secondary';
            remove.textContent = 'Remove';
            remove.addEventListener('click', async () => {
                if (!elements.device.value) return;
                try {
                    await jsonRequest(`/api/devices/${encodeURIComponent(elements.device.value)}/tiktok/pipeline/items/${encodeURIComponent(item.id)}`, {
                        method: 'DELETE',
                    });
                    await refreshPipeline();
                } catch (error) {
                    elements.status.textContent = errorMessage(error);
                }
            });
            row.append(remove);
        }
        elements.list.append(row);
    }
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character] ?? character));
}

async function refreshPipeline(): Promise<void> {
    const udid = elements.device.value;
    if (!udid) {
        elements.list.classList.remove('loading-card');
        elements.list.textContent = 'Select a device…';
        elements.auto.checked = false;
        elements.status.textContent = '';
        return;
    }
    elements.list.classList.add('loading-card');
    elements.list.innerHTML = '<span class="spinner" aria-hidden="true"></span>Loading queue…';
    try {
        const state = await jsonRequest(`/api/devices/${encodeURIComponent(udid)}/tiktok/pipeline`) as PipelineState;
        elements.auto.checked = state.enabled;
        if (state.frequency) elements.frequency.value = state.frequency;
        const label = state.frequencyLabel
            ?? state.checkTimes.map((entry) => entry.label ?? entry.localTime).filter(Boolean).join(', ');
        elements.status.textContent = state.enabled
            ? `Auto on · ${label}`
            : `Auto off · frequency set to ${label || 'production'} — enable auto or use Check now.`;
        renderItems(state.items);
        const next = new URL(location.href);
        next.searchParams.set('template', 'pipeline');
        next.searchParams.set('device', udid);
        history.replaceState(null, '', next);
    } catch (error) {
        elements.list.classList.remove('loading-card');
        elements.list.textContent = errorMessage(error);
    }
}

async function saveAutoSettings(enabled: boolean): Promise<void> {
    const udid = elements.device.value;
    if (!udid) throw new Error('Select a device first.');
    await jsonRequest(`/api/devices/${encodeURIComponent(udid)}/tiktok/pipeline/auto`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled, frequency: elements.frequency.value }),
    });
}

for (const button of elements.templates) {
    button.addEventListener('click', () => selectTemplate(button.dataset.template ?? 'pipeline'));
}

elements.device.addEventListener('change', () => void refreshPipeline());
elements.refresh.addEventListener('click', () => void refreshPipeline());

elements.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const udid = elements.device.value;
    if (!udid) { elements.addResult.textContent = 'Select a device first.'; return; }
    const file = elements.video.files?.[0];
    if (!file) { elements.addResult.textContent = 'Choose a video.'; return; }
    const caption = elements.caption.value.trim();
    if (!caption) { elements.addResult.textContent = 'Add a title / caption.'; return; }
    const form = new FormData();
    form.append('media', file, file.name);
    form.append('caption', caption);
    elements.addResult.textContent = 'Uploading…';
    try {
        await jsonRequest(`/api/devices/${encodeURIComponent(udid)}/tiktok/pipeline/items`, { method: 'POST', body: form });
        elements.video.value = '';
        elements.caption.value = '';
        elements.addResult.textContent = 'Added to queue.';
        await refreshPipeline();
    } catch (error) {
        elements.addResult.textContent = errorMessage(error);
    }
});

elements.auto.addEventListener('change', async () => {
    const previous = !elements.auto.checked;
    if (!elements.device.value) {
        elements.auto.checked = false;
        elements.status.textContent = 'Select a device first.';
        return;
    }
    elements.status.textContent = 'Saving…';
    try {
        await saveAutoSettings(elements.auto.checked);
        await refreshPipeline();
    } catch (error) {
        elements.auto.checked = previous;
        elements.status.textContent = errorMessage(error);
    }
});

elements.frequency.addEventListener('change', async () => {
    if (!elements.device.value) {
        elements.status.textContent = 'Select a device first.';
        return;
    }
    // Persist the cadence whenever it changes; re-arm schedules if auto is already on.
    elements.status.textContent = 'Updating frequency…';
    try {
        await saveAutoSettings(elements.auto.checked);
        await refreshPipeline();
    } catch (error) {
        elements.status.textContent = errorMessage(error);
        await refreshPipeline().catch(() => undefined);
    }
});

elements.checkNow.addEventListener('click', async () => {
    const udid = elements.device.value;
    if (!udid) { elements.status.textContent = 'Select a device first.'; return; }
    elements.status.textContent = 'Queuing check…';
    try {
        await jsonRequest(`/api/devices/${encodeURIComponent(udid)}/tiktok/pipeline/check-now`, { method: 'POST' });
        elements.status.textContent = 'Check queued — watch Tasks / device activity for the publish run.';
        await refreshPipeline();
    } catch (error) {
        elements.status.textContent = errorMessage(error);
    }
});

selectTemplate(
    params.get('template') === 'pipeline' || params.has('device') ? 'pipeline' : '',
    { refresh: false },
);
void loadDevices().then(() => {
    if (!elements.workspace.hidden) return refreshPipeline();
}).catch((error) => {
    elements.status.textContent = errorMessage(error);
});
