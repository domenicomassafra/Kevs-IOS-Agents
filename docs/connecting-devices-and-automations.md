# Connecting real and virtual mobile devices

The normal production shape is one MiniPC control plane plus one or more execution hosts. The browser, Hermes and MCP talk to the MiniPC; the execution host owns USB/Xcode/ADB/Appium locally.

## 1. Pair an execution host with the MiniPC

On the execution Mac, configure `.env` from `.env.device-worker.example` and set the same private worker token used by the MiniPC. The MiniPC lists workers with:

```text
PHONE_FARM_DEVICE_WORKERS=macstudio=http://macstudio:3010,air=http://macbook-air:3010
```

The worker advertises its capabilities to the dashboard. A Mac can expose physical iPhones, iOS Simulators and Android devices/emulators at the same time.

The runtime split is intentional:

```text
:4725  Appium 2 + custom WDA       physical iPhone social recipes
:4726  Appium 3 + XCUITest/UIA2    iOS Simulator + Android real/emulated
```

`./deploy/setup-device-worker.sh` installs both isolated driver homes and launchd services.

## 2. Connect several real iPhones

Connect every owner-controlled iPhone to the Mac by USB, unlock it, trust the Mac and enable Developer Mode. Full Xcode and signing are required.

Open **Mobile Farm → Add device**, then run the guided physical-iPhone setup for each device. Each iPhone gets its own registry entry, WDA/MJPEG ports and serialized pg-boss queue. Several phones may be attached to the same Mac; the MiniPC still exposes them as independent devices.

## 3. Attach an iOS Simulator

Install/select full Xcode and create a Simulator normally. It may already be booted, but the Appium/XCUITest runtime can also target an available simulator by UDID.

From the Devices home, each execution host now lists its known virtual runtimes, including shutdown definitions. Click **Boot** to start the Simulator when supported, then open **Mobile Farm → Add device → Virtual & Android runtimes → Scan hosts**. Choose the detected `ios / simulator` entry and click **Attach to farm**. No `devices.json` editing is required.

## 4. Attach a real Android phone

Enable Android Developer Options and USB debugging, connect the phone to an execution host and accept the debugging authorization. Verify it is visible with:

```bash
adb devices -l
```

Then use **Add device → Virtual & Android runtimes → Scan hosts → Attach to farm**. The device uses the Appium 3 + UiAutomator2 lane and becomes a normal schedulable device in the MiniPC control plane.

## 5. Attach an Android Emulator

AVD definitions are also listed under their execution host on the Devices home. Use **Boot** there (or start one in Android Studio). When `adb devices -l` shows an `emulator-*` serial, the same Scan Hosts page exposes it as `android / emulator`; click **Attach to farm**. Use **Stop** from the host card when that virtual runtime is no longer needed.

## 6. Create an automation

Open **Automation Studio → Portable flow**. Pick any supported device, give the flow a name and compose steps such as:

```text
launch app
waitVisible "Email"
inputText target="Email" text="hello@example.com"
tapText "Continue"
assertVisible "Welcome"
waitGone "Loading"
tap / swipe                 # coordinate fallback when semantics are unavailable
type                        # raw text fallback
Home / lock / wake / unlock / volume
screenshot
```

**Run now** creates a normal versioned scheduler task (`com.phone-farm.flow/flow@1`), so it gets the same queueing, stop behavior, logs and execution evidence as built-in tasks.

TikTok/Instagram recipes remain intentionally tied to the physical-iPhone/WDA lane for now because they use calibrated iOS-specific behavior. Generic Appium devices use Portable Flows until those recipes are ported to semantic selectors.

## 7. Semantic/agent control

Both WDA and Appium page sources feed the same semantic snapshot API. Android UiAutomator2 XML and iOS XCUITest XML are normalized into compact stable refs, so Hermes/MCP can inspect and target UI elements without consuming a separate platform-specific selector protocol.

The visual builder now uses that same layer directly. Prefer `tapText`, `waitVisible`, `assertVisible`, `waitGone` and `inputText` over fixed coordinates. Optional exact matching, accessibility element type and per-step timeouts let a flow stay strict where necessary without becoming screen-size-specific.

## 8. Video

Physical iPhones retain WDA MJPEG pending the existing qvh benchmark. Generic Appium devices currently use a bounded screenshot-stream fallback. FARM-021 will benchmark scrcpy for Android and Baguette-style transport for iOS Simulator; video remains separable from control so a streaming failure does not own scheduler correctness.

The **Fleet view** at `/fleet` already follows the low-contention strategy: every device gets an inexpensive still preview, while only the currently focused tile upgrades to a live stream. Filters cover online, iOS, Android, physical, virtual and running devices. This replaces the old mock 20-seat demo with live fleet data.
