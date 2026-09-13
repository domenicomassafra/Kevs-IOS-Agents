import type { PhoneFarmPlugin, TaskDefinition } from './plugin.js';
import type { JsonObject, JsonValue } from './types.js';

type FlowStep =
    | { action: 'launch'; appId: string }
    | { action: 'terminate'; appId: string }
    | { action: 'wait'; milliseconds: number }
    | { action: 'tap'; x: number; y: number }
    | { action: 'swipe'; startX: number; startY: number; endX: number; endY: number; durationMs: number }
    | { action: 'type'; text: string }
    | { action: 'home' | 'lock' | 'wake' | 'unlock' | 'volumeUp' | 'volumeDown' }
    | { action: 'screenshot' };

interface PortableFlowPayload extends JsonObject {
    name: string;
    steps: FlowStep[];
}

const APP_ID = /^[A-Za-z0-9._-]{2,255}$/;

function record(value: JsonValue, message: string): Record<string, JsonValue> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
    return value;
}

function finite(value: JsonValue | undefined, label: string, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
        throw new Error(`${label} must be between ${min} and ${max}`);
    }
    return value;
}

function parseStep(value: JsonValue, index: number): FlowStep {
    const step = record(value, `steps[${index}] must be an object`);
    const action = step.action;
    if (typeof action !== 'string') throw new Error(`steps[${index}].action is required`);
    if (action === 'launch' || action === 'terminate') {
        if (typeof step.appId !== 'string' || !APP_ID.test(step.appId)) throw new Error(`steps[${index}].appId is invalid`);
        return { action, appId: step.appId };
    }
    if (action === 'wait') {
        return { action, milliseconds: Math.round(finite(step.milliseconds, `steps[${index}].milliseconds`, 50, 300_000)) };
    }
    if (action === 'tap') {
        return {
            action,
            x: finite(step.x, `steps[${index}].x`, 0, 100_000),
            y: finite(step.y, `steps[${index}].y`, 0, 100_000),
        };
    }
    if (action === 'swipe') {
        return {
            action,
            startX: finite(step.startX, `steps[${index}].startX`, 0, 100_000),
            startY: finite(step.startY, `steps[${index}].startY`, 0, 100_000),
            endX: finite(step.endX, `steps[${index}].endX`, 0, 100_000),
            endY: finite(step.endY, `steps[${index}].endY`, 0, 100_000),
            durationMs: Math.round(finite(step.durationMs, `steps[${index}].durationMs`, 50, 5_000)),
        };
    }
    if (action === 'type') {
        if (typeof step.text !== 'string' || step.text.length < 1 || step.text.length > 4_000) {
            throw new Error(`steps[${index}].text must contain 1 to 4000 characters`);
        }
        return { action, text: step.text };
    }
    if (['home', 'lock', 'wake', 'unlock', 'volumeUp', 'volumeDown'].includes(action)) {
        return { action: action as Extract<FlowStep, { action: string }>['action'] } as FlowStep;
    }
    if (action === 'screenshot') return { action };
    throw new Error(`steps[${index}].action ${JSON.stringify(action)} is unsupported`);
}

const portableFlowTask: TaskDefinition<PortableFlowPayload> = {
    type: 'flow',
    version: 1,
    displayName: 'Portable mobile flow',
    validate(value: JsonValue): PortableFlowPayload {
        const payload = record(value, 'Payload must be an object');
        const name = payload.name;
        const steps = payload.steps;
        if (typeof name !== 'string' || !name.trim() || name.length > 120) throw new Error('name must contain 1 to 120 characters');
        if (!Array.isArray(steps) || steps.length < 1 || steps.length > 100) throw new Error('steps must contain 1 to 100 actions');
        return { name: name.trim(), steps: steps.map(parseStep) };
    },
    summarize: (payload) => `${payload.name} · ${payload.steps.length} steps`,
    estimateDurationMs: (payload) => payload.steps.reduce((total, step) => total + (
        step.action === 'wait' ? step.milliseconds : step.action === 'swipe' ? step.durationMs + 250 : 750
    ), 0),
    retryPolicy: () => ({ retryLimit: 0, retryDelaySeconds: 0, retryBackoff: false }),
    supportsStop: () => true,
    async execute(context, payload) {
        try {
            await context.log(`Portable flow ${payload.name} started (${payload.steps.length} steps)`);
            for (let index = 0; index < payload.steps.length; index += 1) {
                if (context.signal.aborted) return { exitCode: null, stopped: true };
                const step = payload.steps[index]!;
                await context.log(`Step ${index + 1}/${payload.steps.length}: ${step.action}`);
                if (step.action === 'launch') await context.automation.activateApp(step.appId);
                else if (step.action === 'terminate') await context.automation.terminateApp(step.appId);
                else if (step.action === 'wait') await context.automation.pause(step.milliseconds, context.signal);
                else if (step.action === 'tap') await context.automation.tap(step.x, step.y);
                else if (step.action === 'swipe') await context.automation.swipe(step.startX, step.startY, step.endX, step.endY, step.durationMs);
                else if (step.action === 'type') await context.automation.typeText(step.text);
                else if (step.action === 'screenshot') {
                    const image = await context.automation.screenshot();
                    await context.log(`Screenshot captured (${image.byteLength} bytes)`);
                } else await context.automation.system(step.action);
            }
            await context.log(`Portable flow ${payload.name} completed`);
            return { exitCode: 0, stopped: false };
        } catch (error) {
            if (context.signal.aborted) return { exitCode: null, stopped: true };
            return { exitCode: null, stopped: false, error: error instanceof Error ? error.message : String(error) };
        }
    },
};

export const portableFlowPlugin: PhoneFarmPlugin = {
    id: 'com.phone-farm.flow',
    version: '1.0.0',
    displayName: 'Portable Flows',
    tasks: [portableFlowTask],
};

export default portableFlowPlugin;
