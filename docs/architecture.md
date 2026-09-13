# Architecture — what does what

Mobile Farm is a control plane plus execution-host runtimes over one PostgreSQL
database and a few local state files. There is no client framework: the
dashboard is server-rendered HTML with HTMX. Physical iPhones keep their
specialized WDA video/control path, while generic Appium runtimes expose the
same dashboard contract through screenshot streaming and shared input methods.

```
                         ┌───────────────────────────────┐
  browser  ── HTTP ─────▶│  web  (Fastify + HTMX)  :3000 │
                         │  dashboard, JSON API,         │
                         │  plugin panels & routes       │
                         └───────┬───────────────┬───────┘
                                 │ SQL           │ HTTP (Unix socket)
                                 ▼               ▼
        ┌────────────────────────────┐   ┌──────────────────────────┐
        │ PostgreSQL                 │   │ wda-service              │
        │  scheduler.*  pgboss.*     │   │  1 WebDriverAgent / phone│
        │  drizzle.*                 │   │  forwards :8100+ / :9100+ │
        └───────▲────────────────────┘   └───────────┬──────────────┘
                │ SQL / pg-boss                      │ USB
        ┌───────┴────────────┐              ┌────────▼─────────┐
        │ worker             │─────────────▶│ Appium 2 :4725   │──▶ physical iPhone/WDA recipes
        │  runs due tasks    │              ├──────────────────┤
        │                    │─────────────▶│ Appium 3 :4726   │──▶ iOS Simulator / Android
        └────────────────────┘              └──────────────────┘
```

## The four processes

### `web` — `src/api/server.ts` → `startServer()` → `src/api/app.ts`
Fastify app on `WEB_PORT` (default 3000).

- Server‑rendered dashboard (`/`, `/devices/:udid`, `/tasks`, `/devices/register`).
- JSON API under `/api/*` (devices, registrations, schedules, executions,
  assets, remote control).
- Live device screen: `GET /api/devices/:udid/remote/stream` proxies the
  phone's MJPEG feed (used on the device page; the device **grid** uses
  periodic `…/remote/screenshot` stills instead). The proxy aborts the
  upstream feed when the browser disconnects. `POST …/remote/action` forwards
  tap/swipe to WDA.
- Loads plugins (`PHONE_FARM_PLUGINS`) and the auth provider
  (`PHONE_FARM_AUTH_PLUGIN`); mounts each plugin's **panels** on the device
  page and its **routes** under `/plugins/<pluginId>`.
- `assertSafeBind(host, authProvider)` refuses a non‑loopback bind with no
  auth provider.
- Owns device **registration** (`DeviceRegistrationService`) and creates the
  scheduler runtime used to enqueue work.

### `worker` — `src/scheduler/worker.ts` → `startWorker()`
Headless. Owns task execution.

- One pg-boss worker per **active** registered device. A device with `disabled: true` in `devices.json`
  is skipped here and by `wda-service` — the entry stays but nothing supervises
  it.
- Every 5 s, `materializeDue()` turns due schedules into `executions` rows and
  enqueues jobs; every 30 s it picks up newly registered devices.
- For each job: `executeAutomation()` (`src/scheduler/executor.ts`) resolves the
  device backend (WDA or generic Appium), waits for the required runtime, builds a `TaskExecutionContext`, and
  calls the task's `execute()`. Handles attempts, retry policy, stop requests,
  and the run‑window deadline.
- Must load the **same plugin versions** as `web`.

### `wda-service` — `src/devices/wda-service.ts`
Persistent WebDriverAgent supervisor, controlled over a Unix socket
(`.wda/wda-service.sock`).

- Keeps one WDA session alive per registered device, (re)launching
  `xcodebuild test-without-building` as needed and USB‑forwarding WDA
  (`8100`, `8101`, …) and MJPEG (`9100`, `9101`, …).
- `GET /health` on the socket reports per‑device `{ physical, wda, appium,
  message }`. States: `ready`, `unlock-required`, `error`, …
- Single‑supervisor by design; a lock prevents duplicates.

### `appium` legacy lane — `:4725`
The existing Appium 2 + pinned XCUITest/WDA stack is isolated in
`APPIUM_HOME=.appium2`. Physical-iPhone social recipes still depend on custom
WDA endpoints, so this lane is deliberately retained until FARM-017 ports those
extensions to modern WDA. Dashboard control for this lane talks directly to WDA.

### `appium-runtime` modern lane — `:4726`
Appium 3 lives side-by-side under `APPIUM_HOME=.appium-runtime`, with modern
XCUITest for iOS Simulator and UiAutomator2 for Android. `AppiumRemoteControl`
provides screen info, screenshots, input, app lifecycle and a bounded
screenshot stream. Its XML page source is normalized into the same semantic
snapshot/ref model used by WDA, so Hermes/MCP do not need a second selector API.

Workers discover iOS Simulators through `xcrun simctl` and Android
physical/emulated devices through `adb`; the dashboard can attach those
runtimes without hand-editing `devices.json`.

## Xcode, signing, and device pairing

The farm never talks to a device directly at the USB level for *control* — it
delegates the whole pair/trust/sign/launch chain to Xcode's toolchain:

- **Pairing & trust** are the OS's job. An iPhone must be paired (USB + "Trust
  This Computer") and, on iOS 16+, have **Developer Mode** enabled before any
  of this works. `xcrun xctrace list devices` / `discoverConnectedDevices()`
  (`appium-ios-device`, over `usbmuxd`) is how the app learns a device is
  attached; it does not initiate pairing.
- **The Developer Disk Image** for the device's iOS version is mounted by
  Xcode on first pair. `xcodebuild` needs it present to launch a test bundle.
- **Signing.** `src/devices/wda/prepare.ts` runs `xcodebuild build-for-testing`
  with `CODE_SIGN_STYLE=Automatic` and `DEVELOPMENT_TEAM=$XCODE_ORG_ID`. Xcode
  automatic signing creates/refreshes a development provisioning profile that
  lists the connected UDIDs and embeds it in `WebDriverAgentRunner-Runner.app`.
  This is why a new device must be plugged in (and the Apple ID have a free
  slot — the 100-UDID limit) when `wda:prepare` runs. Signing reads a
  certificate from the **login keychain**, which is only unlocked in a
  graphical session — hence the "run from Terminal.app, not SSH" rule.
- **Launch.** `wda-service` runs `xcodebuild test-without-building
  -destination id=<udid>` per active device: it installs the pre-signed
  `WebDriverAgentRunner` and starts it as a UI test. WDA then serves HTTP on
  the device's `:8100` and MJPEG on `:9100`, which `wda-service` USB-forwards
  to the host's `:81xx` / `:91xx`.

The **registration wizard** (`src/devices/registration.ts`) is a UI over this
chain: its `host` / `connection` / `signing` / `developer` / `wda` checks each
probe one link (Xcode selected, device visible over usbmux, a signing identity
present, the DDI mounted, WDA reachable) and surface a specific fix before the
device is written to `devices.json`. `wda:prepare` is the same signing step
without the UI, for scripted or bulk (`--all`) setup.

## Data & state

| Store | Contents |
| --- | --- |
| PostgreSQL `scheduler.*` | `schedules`, `executions`, `execution_attempts`, `execution_logs`, `assets`. Drizzle ORM; migrations in `drizzle/`. |
| PostgreSQL `pgboss.*` | Job queue (one partitioned queue per device). |
| PostgreSQL `drizzle.*` | Applied‑migration ledger. |
| `devices.json` | Registered devices: `udid`, `name`, `platform`, `kind`, `automationBackend`, owner `workerId`, optional WDA ports/coordinates/passcode and `pluginData`. Git-ignored, `0600`. |
| `.env` | Configuration and secrets (DB URL, signing IDs, auth keys). Git‑ignored. Device passcodes live in `devices.json`, not here. |
| `.scheduler-data/assets/` | Uploaded media for `post`‑style tasks, content‑addressed. |
| `.wda/` | wda-service socket and locks. |
| `.appium2/` | Isolated Appium home with the pinned XCUITest driver. |
| `.appium-runtime/` | Isolated Appium 3 home with modern XCUITest + UiAutomator2 drivers. |

## The task model

Every schedule and execution row carries a **task envelope**:

```
pluginId : string        e.g. "com.git-agni.tiktok" or "com.git-agni.instagram"
taskType : string        e.g. "doomscroll"
taskVersion : integer     e.g. 1
payload : jsonb          validated, version-specific shape
```

`PluginRegistry.task({pluginId, taskType, taskVersion})` resolves the envelope
to a `TaskDefinition`. Because the version is stored, **an old schedule can
never silently run a new contract** — if `taskVersion` 1 is no longer
installed, that schedule fails loudly instead of executing v2 logic.

### Portable semantic flows

`com.phone-farm.flow/flow@1` is the platform-neutral automation contract. Coordinate tap/swipe remains available as a fallback, but the preferred steps use the common accessibility tree: `tapText`, `waitVisible`, `assertVisible`, `waitGone`, and `inputText`. WDA JSON, XCUITest XML and UiAutomator2 XML are normalized into the same stable-ref snapshot model before those actions run. This keeps scheduler contracts independent of Appium/WDA and lets the same flow survive device-size changes when labels and accessibility roles remain stable.

### Virtual runtime lifecycle

Execution workers expose both currently connected devices and known virtual-runtime definitions. macOS workers use `simctl` for iOS Simulator definitions and lifecycle; hosts with Android tooling use the emulator CLI plus ADB for AVD definitions and shutdown. The MiniPC proxies Boot/Stop to the owning worker rather than trying to run mobile SDK tooling inside the Linux control-plane container.

### Live fleet wall

`/fleet` is the real fleet view. It intentionally does not open a high-rate stream for every device: tiles refresh inexpensive still screenshots, while the selected tile alone requests the signed live-stream capability. This follows the lab UX pattern from Baguette/STF and keeps video transport separate from scheduler/control correctness.

`com.phone-farm.flow/flow@1` is the generic cross-platform contract. Its payload
is an ordered list of portable actions (app launch/terminate, wait, tap, swipe,
type, system buttons and screenshot), authored in Automation Studio and queued
through the exact same scheduler/evidence path as plugin-specific tasks.

## Scheduling

`ScheduleTiming` (`src/types.ts`):

| kind | fields |
| --- | --- |
| `now` | — |
| `once` | `runAt` (ISO) |
| `daily` | `localTime` `"HH:MM"`, `timezone` (IANA) |
| `weekly` | `localTime`, `timezone`, `weekdays` (0–6) |

`run_window_minutes` (default 30) is the grace period after the scheduled time;
past it, the execution is abandoned as "window expired". Recurrence is computed
in `src/scheduler/recurrence.ts`; the next occurrence is written to
`schedules.next_run_at`.

## Source map

| Path | Responsibility |
| --- | --- |
| `src/api/` | Fastify app factory, controllers, middleware, HTTP routes |
| `src/scheduler/` | runtime, repository, pg-boss queue, recurrence, worker, executor |
| `src/database/` | Drizzle client, schema, migrate/setup entrypoints |
| `src/devices/` | physical/virtual discovery, registry (`devices.json`), WDA and Appium remotes, registration flow, wda-service, coordinate profiles, passcode lookup |
| `src/hosts/` | execution-host capability detection (`simctl`, `adb`, Appium, WDA) |
| `src/semantic/` | normalized WDA/Appium accessibility snapshots, stable refs and semantic actions |
| `src/flow-plugin.ts` | built-in portable cross-platform flow task |
| `src/devices/wda/` | `prepare.ts` (patch + build + sign WDA), `start.ts` (single-device WDA supervisor), `target-device.ts` (resolve which device a CLI command targets), diagnostics |
| `src/tiktok/` | TikTok automation entrypoints (`doomscroll.ts`, `post.ts`), OCR, coordinates |
| `src/tiktok-plugin.ts` | Built‑in TikTok plugin: task definitions, device panel, routes |
| `src/instagram/` | Instagram automation entrypoints (`doomscroll.ts`, `post.ts`), OCR, coordinates |
| `src/instagram-plugin.ts` | Built‑in Instagram plugin: task definitions, device panel, routes |
| `src/plugin.ts` | **Stable plugin & auth interfaces** |
| `src/registry.ts` | `PluginRegistry` — task resolution and validation |
| `src/loader.ts` | Dynamic import of `PHONE_FARM_PLUGINS` / `PHONE_FARM_AUTH_PLUGIN` |
| `src/example-plugin.ts` | Minimal reference plugin |
| `static/dashboard/` | HTML templates, browser TS (`tsconfig.web.json` → `static/dashboard/assets/*.js`) |
| `Patches/` | WDA source patches applied by `wda:prepare` |
| `drizzle/` | SQL migrations + journal |
