const schedulesElement = document.querySelector('#schedules');
const executionsElement = document.querySelector('#executions');
const refresh = document.querySelector('#refresh-tasks');
const search = document.querySelector('#runs-search');
const statusFilter = document.querySelector('#runs-status');
const summary = document.querySelector('#runs-summary');
let schedulesCache = [];
let executionsCache = [];
let deviceNames = new Map();
function shortDevice(udid) {
    return udid.length > 20 ? `${udid.slice(0, 8)}…${udid.slice(-6)}` : udid;
}
function deviceLabel(udid) {
    return deviceNames.get(udid) ?? shortDevice(udid);
}
function date(value) {
    return value ? new Date(value).toLocaleString() : '—';
}
function pluginLabel(pluginId) {
    if (pluginId === 'com.phone-farm.flow')
        return 'Portable flow';
    if (pluginId === 'com.git-agni.instagram')
        return 'Instagram';
    if (pluginId === 'com.git-agni.tiktok')
        return 'TikTok';
    return pluginId.replace(/^com\.(?:git-agni\.|phone-farm\.)/, '');
}
function taskLabel(pluginId, taskType) {
    if (pluginId === 'com.phone-farm.flow' && taskType === 'flow')
        return 'Portable flow';
    return `${pluginLabel(pluginId)} ${taskType}`;
}
function timingLabel(timing) {
    if (timing.kind === 'interval' && timing.everyMinutes)
        return `every ${timing.everyMinutes}m`;
    if ((timing.kind === 'daily' || timing.kind === 'weekly') && timing.localTime)
        return `${timing.kind} · ${timing.localTime}`;
    if (timing.kind === 'once' && timing.runAt)
        return `once · ${date(timing.runAt)}`;
    return timing.kind;
}
function queryMatch(values) {
    const query = search.value.trim().toLowerCase();
    return !query || values.some((value) => value.toLowerCase().includes(query));
}
function filteredSchedules() {
    const wanted = statusFilter.value;
    return schedulesCache.filter((schedule) => (!wanted || schedule.status === wanted)
        && queryMatch([deviceLabel(schedule.deviceUdid), schedule.deviceUdid, schedule.pluginId, pluginLabel(schedule.pluginId), schedule.taskType, taskLabel(schedule.pluginId, schedule.taskType)]));
}
function filteredExecutions() {
    const wanted = statusFilter.value;
    return executionsCache.filter((execution) => (!wanted || execution.status === wanted)
        && queryMatch([deviceLabel(execution.deviceUdid), execution.deviceUdid, execution.pluginId, pluginLabel(execution.pluginId), execution.taskType, taskLabel(execution.pluginId, execution.taskType)]));
}
async function request(url, options) {
    const response = await fetch(url, options);
    const body = await response.json();
    if (!response.ok)
        throw new Error(body.error ?? `Request failed (${response.status})`);
    return body;
}
function button(label, action) {
    const value = document.createElement('button');
    value.className = 'icon-button';
    value.type = 'button';
    value.textContent = label;
    value.addEventListener('click', () => void action().catch((error) => {
        window.alert(error instanceof Error ? error.message : String(error));
    }));
    return value;
}
function renderSchedules(items) {
    if (!items.length) {
        schedulesElement.className = 'task-list empty-state';
        schedulesElement.innerHTML = `<h3>${schedulesCache.length ? 'No schedules match this filter' : 'No schedules yet'}</h3><p>${schedulesCache.length ? 'Change the search or status filter.' : 'Create a portable flow or app automation to schedule work.'}</p>`;
        return;
    }
    schedulesElement.className = 'task-list';
    schedulesElement.replaceChildren(...items.map((schedule) => {
        const row = document.createElement('article');
        row.className = 'task-row';
        const copy = document.createElement('div');
        const title = document.createElement('h3');
        title.textContent = `${taskLabel(schedule.pluginId, schedule.taskType)} · ${deviceLabel(schedule.deviceUdid)}`;
        const meta = document.createElement('p');
        meta.textContent = `${shortDevice(schedule.deviceUdid)} · ${timingLabel(schedule.timing)} · next ${date(schedule.nextRunAt)}`;
        copy.append(title, meta);
        const state = document.createElement('span');
        state.className = `status ${schedule.status}`;
        state.textContent = schedule.status;
        const actions = document.createElement('div');
        actions.className = 'inline-actions';
        if (schedule.status === 'active' || schedule.status === 'paused')
            actions.append(button('Edit', async () => {
                const timingText = window.prompt('Edit timing JSON', JSON.stringify(schedule.timing));
                if (!timingText)
                    return;
                const windowText = window.prompt('Run-within window in minutes', String(schedule.runWindowMinutes));
                if (!windowText)
                    return;
                const timing = JSON.parse(timingText);
                const recurringPublish = schedule.payload.type === 'post' && schedule.payload.destination === 'publish'
                    && (timing.kind === 'daily' || timing.kind === 'weekly');
                if (recurringPublish && !window.confirm('Confirm that this recurring schedule may publish publicly without confirmation on each occurrence.'))
                    return;
                await request(`/api/schedules/${schedule.id}`, {
                    method: 'PATCH', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ timing, runWindowMinutes: Number(windowText), recurringPublishConfirmed: recurringPublish }),
                });
                await load();
            }));
        if (schedule.status === 'active')
            actions.append(button('Pause', async () => { await request(`/api/schedules/${schedule.id}/pause`, { method: 'POST' }); await load(); }));
        if (schedule.status === 'paused')
            actions.append(button('Resume', async () => { await request(`/api/schedules/${schedule.id}/resume`, { method: 'POST' }); await load(); }));
        if (schedule.status !== 'cancelled' && schedule.status !== 'completed')
            actions.append(button('Cancel', async () => { await request(`/api/schedules/${schedule.id}/cancel`, { method: 'POST' }); await load(); }));
        row.append(copy, state, actions);
        return row;
    }));
}
function renderExecutions(items) {
    if (!items.length) {
        executionsElement.className = 'task-list empty-state';
        executionsElement.innerHTML = `<h3>${executionsCache.length ? 'No executions match this filter' : 'No executions yet'}</h3><p>${executionsCache.length ? 'Change the search or status filter.' : 'Runs appear here as soon as an automation enters the scheduler.'}</p>`;
        return;
    }
    executionsElement.className = 'task-list';
    executionsElement.replaceChildren(...items.map((execution) => {
        const row = document.createElement('article');
        row.className = 'task-row';
        const copy = document.createElement('div');
        const title = document.createElement('h3');
        title.textContent = `${taskLabel(execution.pluginId, execution.taskType)} · ${deviceLabel(execution.deviceUdid)}`;
        const meta = document.createElement('p');
        meta.textContent = `${shortDevice(execution.deviceUdid)} · ${date(execution.scheduledFor)}${execution.error ? ` · ${execution.error}` : ''}`;
        copy.append(title, meta);
        const state = document.createElement('span');
        state.className = `status ${execution.status}`;
        state.textContent = execution.status;
        const actions = document.createElement('div');
        actions.className = 'inline-actions';
        if (execution.status === 'queued' || (execution.status === 'running' && execution.taskType === 'doomscroll')) {
            actions.append(button(execution.status === 'queued' ? 'Cancel' : 'Stop', async () => {
                await request(`/api/executions/${execution.id}/stop`, { method: 'POST' });
                await load();
            }));
        }
        if (execution.status === 'failed' || execution.status === 'stopped') {
            actions.append(button('Retry', async () => {
                if (execution.taskType === 'post'
                    && !window.confirm(`The post may already have reached ${pluginLabel(execution.pluginId)}. Retry only after checking the device.`))
                    return;
                await request(`/api/executions/${execution.id}/retry`, { method: 'POST' });
                await load();
            }));
        }
        row.append(copy, state, actions);
        return row;
    }));
}
async function load() {
    refresh.disabled = true;
    try {
        const [scheduleData, executionData, devices] = await Promise.all([
            request('/api/schedules'),
            request('/api/executions'),
            request('/api/devices'),
        ]);
        deviceNames = new Map(devices.map((device) => [device.udid, device.name]));
        schedulesCache = scheduleData.schedules;
        executionsCache = executionData.executions;
        render();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        schedulesElement.textContent = message;
        executionsElement.textContent = message;
    }
    finally {
        refresh.disabled = false;
    }
}
function render() {
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
export {};
