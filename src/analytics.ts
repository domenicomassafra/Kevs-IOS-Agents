import type { FleetAccount } from './accounts.js';
import type { ExecutionRow, ScheduleRow } from './database/schema.js';

export interface FleetHealthDevice {
    udid: string;
    name: string;
    disabled?: boolean;
    connected?: unknown;
}

export interface FleetHealthReport {
    generatedAt: string;
    summary: {
        devices: number;
        readyDevices: number;
        disabledDevices: number;
        accounts: number;
        pausedAccounts: number;
        activeSchedules: number;
        queuedExecutions: number;
        runningExecutions: number;
        recentSuccessRate: number | null;
        averageQueueLatencyMs: number | null;
    };
    devices: Array<{
        udid: string;
        name: string;
        state: 'disabled' | 'connected' | 'offline';
        accountCount: number;
        pausedAccountCount: number;
        activeScheduleCount: number;
        queuedCount: number;
        runningCount: number;
        latestOutcome?: string;
        latestFinishedAt?: string;
    }>;
    accounts: Array<{
        platform: string;
        handle: string;
        deviceUdid: string;
        paused: boolean;
        executions: number;
        succeeded: number;
        failed: number;
        successRate: number | null;
    }>;
}

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled', 'skipped', 'stopped']);

export function buildFleetHealth(
    devices: readonly FleetHealthDevice[],
    accounts: readonly FleetAccount[],
    schedules: readonly ScheduleRow[],
    executions: readonly ExecutionRow[],
    now = new Date(),
): FleetHealthReport {
    const terminal = executions.filter((execution) => TERMINAL.has(execution.status));
    const successRate = terminal.length
        ? terminal.filter((execution) => execution.status === 'succeeded').length / terminal.length
        : null;
    const queueLatencies = executions
        .filter((execution) => execution.startedAt)
        .map((execution) => Math.max(0, execution.startedAt!.getTime() - execution.createdAt.getTime()));
    const averageQueueLatencyMs = queueLatencies.length
        ? Math.round(queueLatencies.reduce((sum, value) => sum + value, 0) / queueLatencies.length)
        : null;

    const deviceRows = devices.map((device) => {
        const deviceAccounts = accounts.filter((account) => account.deviceUdid === device.udid);
        const deviceSchedules = schedules.filter((schedule) => schedule.deviceUdid === device.udid && schedule.status === 'active');
        const deviceExecutions = executions.filter((execution) => execution.deviceUdid === device.udid);
        const latest = [...deviceExecutions]
            .filter((execution) => execution.finishedAt)
            .sort((a, b) => b.finishedAt!.getTime() - a.finishedAt!.getTime())[0];
        return {
            udid: device.udid,
            name: device.name,
            state: device.disabled ? 'disabled' as const : device.connected ? 'connected' as const : 'offline' as const,
            accountCount: deviceAccounts.length,
            pausedAccountCount: deviceAccounts.filter((account) => account.policy?.paused).length,
            activeScheduleCount: deviceSchedules.length,
            queuedCount: deviceExecutions.filter((execution) => execution.status === 'queued').length,
            runningCount: deviceExecutions.filter((execution) => execution.status === 'running').length,
            ...(latest ? { latestOutcome: latest.status, latestFinishedAt: latest.finishedAt!.toISOString() } : {}),
        };
    });

    const accountRows = accounts.map((account) => {
        const relevant = executions.filter((execution) => {
            if (execution.deviceUdid !== account.deviceUdid) return false;
            const payloadAccount = typeof execution.payload.account === 'string' ? execution.payload.account : undefined;
            return (execution.campaignAccount ?? payloadAccount) === account.handle;
        });
        const relevantTerminal = relevant.filter((execution) => TERMINAL.has(execution.status));
        const succeeded = relevantTerminal.filter((execution) => execution.status === 'succeeded').length;
        const failed = relevantTerminal.filter((execution) => execution.status === 'failed').length;
        return {
            platform: account.platform,
            handle: account.handle,
            deviceUdid: account.deviceUdid,
            paused: account.policy?.paused === true,
            executions: relevant.length,
            succeeded,
            failed,
            successRate: relevantTerminal.length ? succeeded / relevantTerminal.length : null,
        };
    });

    return {
        generatedAt: now.toISOString(),
        summary: {
            devices: devices.length,
            readyDevices: deviceRows.filter((device) => device.state === 'connected').length,
            disabledDevices: deviceRows.filter((device) => device.state === 'disabled').length,
            accounts: accounts.length,
            pausedAccounts: accounts.filter((account) => account.policy?.paused).length,
            activeSchedules: schedules.filter((schedule) => schedule.status === 'active').length,
            queuedExecutions: executions.filter((execution) => execution.status === 'queued').length,
            runningExecutions: executions.filter((execution) => execution.status === 'running').length,
            recentSuccessRate: successRate,
            averageQueueLatencyMs,
        },
        devices: deviceRows,
        accounts: accountRows,
    };
}
