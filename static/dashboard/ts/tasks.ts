export {};

interface Schedule {
    id: string;
    deviceUdid: string;
    pluginId: string;
    taskType: string;
    status: 'active' | 'paused' | 'completed' | 'cancelled';
    timing: { kind: string; localTime?: string; timezone?: string; weekdays?: number[]; runAt?: string; everyMinutes?: number };
    nextRunAt: string | null;
    runWindowMinutes: number;
    payload: { type: string; destination?: string };
}

interface Execution {
    id: string;
    deviceUdid: string;
    pluginId: string;
    taskType: string;
    status: string;
    scheduledFor: string;
    startedAt: string | null;
    finishedAt: string | null;
    error: string | null;
}

const schedulesElement = document.querySelector<HTMLElement>('#schedules')!;
const executionsElement = document.querySelector<HTMLElement>('#executions')!;
const refresh = document.querySelector<HTMLButtonElement>('#refresh-tasks')!;
const search = document.querySelector<HTMLInputElement>('#runs-search')!;
const statusFilter = document.querySelector<HTMLSelectElement>('#runs-status')!;
const summary = document.querySelector<HTMLElement>('#runs-summary')!;
let schedulesCache: Schedule[] = [];
let executionsCache: Execution[] = [];
let deviceNames = new Map<string, string>();

function shortDevice(udid: string): string {
    return udid.length > 20 ? `${udid.slice(0, 8)}…${udid.slice(-6)}` : udid;
}

function deviceLabel(udid: string): string {
    return deviceNames.get(udid) ?? shortDevice(udid);
}

function date(value: string | null): string {
    return value ? new Date(value).toLocaleString() : '—';
}

function pluginLabel(pluginId: string): string {
    if (pluginId === 'com.phone-farm.flow') return 'Portable flow';
    if (pluginId === 'com.git-agni.instagram') return 'Instagram';
    if (pluginId === 'com.git-agni.tiktok') return 'TikTok';
    return pluginId.replace(/^com\.(?:git-agni\.|phone-farm\.)/, '');
}

function taskLabel(pluginId: string, taskType: string): string {
    if (pluginId === 'com.phone-farm.flow' && taskType === 'flow') return 'Portable flow';
    return `${pluginLabel(pluginId)} ${taskType}`;
}

function timingLabel(timing: Schedule['timing']): string {
    if (timing.kind === 'interval' && timing.everyMinutes) return `every ${timing.everyMinutes}m`;
    if ((timing.kind === 'daily' || timing.kind === 'weekly') && timing.localTime) return `${timing.kind} · ${timing.localTime}`;
    if (timing.kind === 'once' && timing.runAt) return `once · ${date(timing.runAt)}`;
    return timing.kind;
}

function queryMatch(values: string[]): boolean {
    const query = search.value.trim().toLowerCase();
    return !query || values.some((value) => value.toLowerCase().includes(query));
}

function filteredSchedules(): Schedule[] {
    const wanted = statusFilter.value;
    return schedulesCache.filter((schedule) => (!wanted || schedule.status === wanted)
        && queryMatch([deviceLabel(schedule.deviceUdid), schedule.deviceUdid, schedule.pluginId, pluginLabel(schedule.pluginId), schedule.taskType, taskLabel(schedule.pluginId, schedule.taskType)]));
}

function filteredExecutions(): Execution[] {
    const wanted = statusFilter.value;
    return executionsCache.filter((execution) => (!wanted || execution.status === wanted)
        && queryMatch([deviceLabel(execution.deviceUdid), execution.deviceUdid, execution.pluginId, pluginLabel(execution.pluginId), execution.taskType, taskLabel(execution.pluginId, execution.taskType)]));
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, options);
    const body = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
    return body;
}

function button(label: string, action: () => Promise<void>): HTMLButtonElement {
    const value = document.createElement('button');
    value.className = 'icon-button'; value.type = 'button'; value.textContent = label;
    value.addEventListener('click', () => void action().catch((error) => {
        window.alert(error instanceof Error ? error.message : String(error));
    }));
    return value;
}

function renderSchedules(items: Schedule[]): void {
    if (!items.length) {
        schedulesElement.className = 'task-list empty-state';
        schedulesElement.innerHTML = `<h3>${schedulesCache.length ? 'No schedules match this filter' : 'No schedules yet'}</h3><p>${schedulesCache.length ? 'Change the search or status filter.' : 'Create a portable flow or app automation to schedule work.'}</p>`;
        return;
    }
    schedulesElement.className = 'task-list';
    schedulesElement.replaceChildren(...items.map((schedule) => {
        const row = document.createElement('article'); row.className = 'task-row';
        const copy = document.createElement('div');
        const title = document.createElement('h3'); title.textContent = `${taskLabel(schedule.pluginId, schedule.taskType)} · ${deviceLabel(schedule.deviceUdid)}`;
        const meta = document.createElement('p'); meta.textContent = `${shortDevice(schedule.deviceUdid)} · ${timingLabel(schedule.timing)} · next ${date(schedule.nextRunAt)}`;
        copy.append(title, meta);
        const state = document.createElement('span'); state.className = `status ${schedule.status}`; state.textContent = schedule.status;
        const actions = document.createElement('div'); actions.className = 'inline-actions';
        if (schedule.status === 'active' || schedule.status === 'paused') actions.append(button('Edit', async () => {
            const timingText = window.prompt('Edit timing JSON', JSON.stringify(schedule.timing));
            if (!timingText) return;
            const windowText = window.prompt('Run-within window in minutes', String(schedule.runWindowMinutes));
            if (!windowText) return;
            const timing = JSON.parse(timingText) as Schedule['timing'];
            const recurringPublish = schedule.payload.type === 'post' && schedule.payload.destination === 'publish'
                && (timing.kind === 'daily' || timing.kind === 'weekly');
            if (recurringPublish && !window.confirm('Confirm that this recurring schedule may publish publicly without confirmation on each occurrence.')) return;
            await request(`/api/schedules/${schedule.id}`, {
                method: 'PATCH', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ timing, runWindowMinutes: Number(windowText), recurringPublishConfirmed: recurringPublish }),
            });
            await load();
        }));
        if (schedule.status === 'active') actions.append(button('Pause', async () => { await request(`/api/schedules/${schedule.id}/pause`, { method: 'POST' }); await load(); }));
        if (schedule.status === 'paused') actions.append(button('Resume', async () => { await request(`/api/schedules/${schedule.id}/resume`, { method: 'POST' }); await load(); }));
        if (schedule.status !== 'cancelled' && schedule.status !== 'completed') actions.append(button('Cancel', async () => { await request(`/api/schedules/${schedule.id}/cancel`, { method: 'POST' }); await load(); }));
        row.append(copy, state, actions); return row;
    }));
}

function renderExecutions(items: Execution[]): void {
    if (!items.length) {
        executionsElement.className = 'task-list empty-state';
        executionsElement.innerHTML = `<h3>${executionsCache.length ? 'No executions match this filter' : 'No executions yet'}</h3><p>${executionsCache.length ? 'Change the search or status filter.' : 'Runs appear here as soon as an automation enters the scheduler.'}</p>`;
        return;
    }
    executionsElement.className = 'task-list';
    executionsElement.replaceChildren(...items.map((execution) => {
        const row = document.createElement('article'); row.className = 'task-row';
        const copy = document.createElement('div');
        const title = document.createElement('h3'); title.textContent = `${taskLabel(execution.pluginId, execution.taskType)} · ${deviceLabel(execution.deviceUdid)}`;
        const meta = document.createElement('p'); meta.textContent = `${shortDevice(execution.deviceUdid)} · ${date(execution.scheduledFor)}${execution.error ? ` · ${execution.error}` : ''}`;
        copy.append(title, meta);
        const state = document.createElement('span'); state.className = `status ${execution.status}`; state.textContent = execution.status;
        const actions = document.createElement('div'); actions.className = 'inline-actions';
        if (execution.status === 'queued' || (execution.status === 'running' && execution.taskType === 'doomscroll')) {
            actions.append(button(execution.status === 'queued' ? 'Cancel' : 'Stop', async () => {
                await request(`/api/executions/${execution.id}/stop`, { method: 'POST' }); await load();
            }));
        }
        if (execution.status === 'failed' || execution.status === 'stopped') {
            actions.append(button('Retry', async () => {
                if (execution.taskType === 'post'
                    && !window.confirm(`The post may already have reached ${pluginLabel(execution.pluginId)}. Retry only after checking the device.`)) return;
                await request(`/api/executions/${execution.id}/retry`, { method: 'POST' }); await load();
            }));
        }
        row.append(copy, state, actions); return row;
    }));
}

async function load(): Promise<void> {
    refresh.disabled = true;
    try {
        const [scheduleData, executionData, devices] = await Promise.all([
            request<{ schedules: Schedule[] }>('/api/schedules'),
            request<{ executions: Execution[] }>('/api/executions'),
            request<Array<{ udid: string; name: string }>>('/api/devices'),
        ]);
        deviceNames = new Map(devices.map((device) => [device.udid, device.name]));
        schedulesCache = scheduleData.schedules;
        executionsCache = executionData.executions;
        render();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        schedulesElement.textContent = message; executionsElement.textContent = message;
    } finally { refresh.disabled = false; }
}

function render(): void {
    renderSchedules(filteredSchedules());
    renderExecutions(filteredExecutions());
    const queued = executionsCache.filter(({ status }) => status === 'queued').length;
    const running = executionsCache.filter(({ status }) => status === 'running').length;
    const failed = executionsCache.filter(({ status }) => status === 'failed').length;
    summary.textContent = `${schedulesCache.length} schedules · ${running} running · ${queued} queued${failed ? ` · ${failed} failed` : ''}`;
}

refresh.addEventListener('click', () => void load());
search.addEventListener('input', render);
statusFilter.addEventListener('change', render);
void load();
setInterval(() => void load(), 5_000);
