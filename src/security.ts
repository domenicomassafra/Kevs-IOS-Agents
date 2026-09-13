import type { AuthProvider } from './plugin.js';

export function isLoopbackHost(host: string): boolean {
    return host === '127.0.0.1' || host === '::1' || host === 'localhost';
}

export function assertSafeBind(host: string, authProvider: AuthProvider | null): void {
    if (!isLoopbackHost(host) && !authProvider) {
        throw new Error('An authentication plugin is required when binding outside the loopback interface');
    }
}
