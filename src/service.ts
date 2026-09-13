import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ServiceName = 'appium' | 'wda' | 'worker' | 'web';

const SERVICES: ServiceName[] = ['appium', 'wda', 'worker', 'web'];

interface ServiceSpec {
    label: string;
    args: string[];
    env?: Record<string, string>;
}

function xml(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function serviceSpecs(root = process.cwd(), node = process.execPath): Record<ServiceName, ServiceSpec> {
    const common = ['--env-file-if-exists=.env', '--env-file-if-exists=.env.devices', '--import', 'tsx'];
    return {
        appium: {
            label: 'com.phone-farm.appium',
            args: [node, 'node_modules/appium/index.js', '--address', '127.0.0.1', '--base-path', '/', '--port', '4725', '--log-level', 'info'],
            env: { APPIUM_HOME: path.join(root, '.appium2') },
        },
        wda: { label: 'com.phone-farm.wda', args: [node, ...common, 'src/devices/wda-service.ts'] },
        worker: { label: 'com.phone-farm.worker', args: [node, ...common, 'src/scheduler/worker.ts'] },
        web: { label: 'com.phone-farm.web', args: [node, ...common, 'src/api/server.ts'] },
    };
}

export function renderLaunchAgent(
    service: ServiceName,
    root = process.cwd(),
    node = process.execPath,
    home = os.homedir(),
): string {
    const spec = serviceSpecs(root, node)[service];
    const logs = path.join(root, '.runtime', 'logs');
    const env = {
        PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
        HOME: home,
        ...(spec.env ?? {}),
    };
    const args = spec.args.map((arg) => `      <string>${xml(arg)}</string>`).join('\n');
    const envXml = Object.entries(env).map(([key, value]) => `      <key>${xml(key)}</key>\n      <string>${xml(value)}</string>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${spec.label}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>WorkingDirectory</key><string>${xml(root)}</string>
  <key>EnvironmentVariables</key>
  <dict>
${envXml}
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${xml(path.join(logs, `${service}.out.log`))}</string>
  <key>StandardErrorPath</key><string>${xml(path.join(logs, `${service}.err.log`))}</string>
</dict>
</plist>
`;
}

export async function renderLaunchAgents(outputDirectory = path.resolve('.runtime/launchd')): Promise<string[]> {
    await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
    await mkdir(path.resolve('.runtime/logs'), { recursive: true, mode: 0o700 });
    const files: string[] = [];
    for (const service of SERVICES) {
        const file = path.join(outputDirectory, `${serviceSpecs()[service].label}.plist`);
        await writeFile(file, renderLaunchAgent(service), { mode: 0o600 });
        files.push(file);
    }
    return files;
}

function launchctl(args: string[], stdio: 'inherit' | 'pipe' = 'inherit'): string {
    return execFileSync('/bin/launchctl', args, { encoding: 'utf8', stdio }) ?? '';
}

export async function installLaunchAgents(): Promise<void> {
    if (process.platform !== 'darwin') throw new Error('launchd supervision is supported only on macOS');
    const rendered = await renderLaunchAgents();
    const target = path.join(os.homedir(), 'Library', 'LaunchAgents');
    await mkdir(target, { recursive: true });
    const domain = `gui/${process.getuid?.() ?? 0}`;
    for (const source of rendered) {
        const destination = path.join(target, path.basename(source));
        await writeFile(destination, await import('node:fs/promises').then(({ readFile }) => readFile(source)), { mode: 0o600 });
        const label = path.basename(destination, '.plist');
        try { launchctl(['bootout', `${domain}/${label}`], 'pipe'); } catch { /* not loaded */ }
        launchctl(['bootstrap', domain, destination]);
    }
}

export async function uninstallLaunchAgents(): Promise<void> {
    if (process.platform !== 'darwin') throw new Error('launchd supervision is supported only on macOS');
    const target = path.join(os.homedir(), 'Library', 'LaunchAgents');
    const domain = `gui/${process.getuid?.() ?? 0}`;
    for (const service of SERVICES) {
        const label = serviceSpecs()[service].label;
        try { launchctl(['bootout', `${domain}/${label}`], 'pipe'); } catch { /* already unloaded */ }
        await rm(path.join(target, `${label}.plist`), { force: true });
    }
}

export function launchdStatus(): Array<{ service: ServiceName; label: string; loaded: boolean; detail?: string }> {
    if (process.platform !== 'darwin') return SERVICES.map((service) => ({ service, label: serviceSpecs()[service].label, loaded: false }));
    const domain = `gui/${process.getuid?.() ?? 0}`;
    return SERVICES.map((service) => {
        const label = serviceSpecs()[service].label;
        try {
            const detail = launchctl(['print', `${domain}/${label}`], 'pipe');
            return { service, label, loaded: true, detail: detail.split('\n').slice(0, 12).join('\n') };
        } catch {
            return { service, label, loaded: false };
        }
    });
}

async function main(): Promise<void> {
    const command = process.argv[2] ?? 'status';
    if (command === 'render') console.log((await renderLaunchAgents()).join('\n'));
    else if (command === 'install') await installLaunchAgents();
    else if (command === 'uninstall') await uninstallLaunchAgents();
    else if (command === 'status') console.log(JSON.stringify(launchdStatus(), null, 2));
    else throw new Error('Usage: service <render|install|uninstall|status>');
}

const entrypoint = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entrypoint && fileURLToPath(import.meta.url) === entrypoint) await main();
