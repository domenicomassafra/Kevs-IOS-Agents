import type { PluginRegistry } from './registry.js';
import type { CreateTaskInput, JsonObject, ScheduleTiming, TaskEnvelope } from './types.js';
import { validateTaskInput } from './scheduler/validation.js';

export interface CampaignTarget {
    deviceUdid: string;
    account?: string;
}

export interface CreateCampaignInput {
    name: string;
    task: TaskEnvelope;
    timing: ScheduleTiming;
    runWindowMinutes?: number;
    targets: CampaignTarget[];
    assetIds?: string[];
}

export interface PlannedCampaign {
    name: string;
    task: TaskEnvelope;
    timing: ScheduleTiming;
    runWindowMinutes?: number;
    targets: CampaignTarget[];
    assetIds: string[];
    tasks: CreateTaskInput[];
    requiresFanOutConfirmation: boolean;
    requiresPublicActionConfirmation: boolean;
}

export function planCampaign(
    registry: PluginRegistry,
    input: CreateCampaignInput,
    pluginDataByDevice: ReadonlyMap<string, JsonObject>,
    now = new Date(),
): PlannedCampaign {
    const name = input.name.replace(/\s+/g, ' ').trim();
    if (!name || name.length > 120) throw new Error('Campaign name must contain 1 to 120 characters');
    if (!Array.isArray(input.targets) || input.targets.length < 1 || input.targets.length > 25) {
        throw new Error('Campaigns require 1 to 25 targets');
    }
    const seen = new Set<string>();
    const targets = input.targets.map((target) => {
        if (!target.deviceUdid || target.deviceUdid.length > 128) throw new Error('Every campaign target needs a device UDID');
        const account = target.account?.trim() || undefined;
        const key = `${target.deviceUdid}\0${account ?? ''}`;
        if (seen.has(key)) throw new Error('Campaign targets must be unique by device and account');
        seen.add(key);
        return { deviceUdid: target.deviceUdid, ...(account ? { account } : {}) };
    });
    const assetIds = [...new Set(input.assetIds ?? [])];
    if (assetIds.some((id) => typeof id !== 'string' || !/^[0-9a-f-]{16,64}$/i.test(id))) {
        throw new Error('Campaign assetIds must be UUID-like identifiers');
    }

    const tasks = targets.map((target) => {
        const pluginData = pluginDataByDevice.get(target.deviceUdid);
        if (!pluginData) throw new Error(`Campaign target device ${target.deviceUdid} is not registered`);
        const payload = target.account
            ? { ...input.task.payload, account: target.account } as JsonObject
            : input.task.payload;
        return validateTaskInput(registry, {
            deviceUdid: target.deviceUdid,
            task: { ...input.task, payload },
            timing: input.timing,
            ...(input.runWindowMinutes !== undefined ? { runWindowMinutes: input.runWindowMinutes } : {}),
        }, pluginData, now);
    });

    const payload = input.task.payload as Record<string, unknown>;
    const requiresPublicActionConfirmation = input.task.taskType === 'cold-dms'
        || (input.task.taskType === 'post' && payload.destination === 'publish');
    return {
        name, task: input.task, timing: input.timing,
        ...(input.runWindowMinutes !== undefined ? { runWindowMinutes: input.runWindowMinutes } : {}),
        targets, assetIds, tasks,
        requiresFanOutConfirmation: targets.length > 1,
        requiresPublicActionConfirmation,
    };
}
