# Product brief — Farming Control Plane

## Product thesis

Build a local-first control plane for a fleet of owner-controlled physical iPhones and social accounts. The product should make deterministic, repeatable workflows cheap and reliable, while exposing a separate semantic/agent layer for novel tasks. The fleet core must remain useful when every LLM is disconnected.

The production authority is the always-on Linux MiniPC. macOS hosts are physical-device execution nodes because Apple signing, Xcode and WebDriverAgent remain macOS-only concerns. The split must not change the operator experience: browser and agent clients talk to the MiniPC while device input/video is securely proxied to the Mac that owns each iPhone.

## Primary outcome

From one dashboard/API, the owner can see every iPhone, the accounts configured on it, device/account readiness, queued and scheduled work, content waiting to publish, and execution evidence. Known workflows run deterministically. Unknown workflows can be delegated to an agent adapter without coupling the scheduler to a model vendor.

## Initial product surface

- Physical iPhone registration, signing, WDA/Appium supervision and remote control.
- Per-device serialized scheduler and execution history.
- Canonical cross-device inventory of TikTok and Instagram accounts.
- Explicit account binding: a task cannot target a handle that is not configured on that phone.
- Content/post pipeline and existing TikTok/Instagram workflow plugins.
- A doctor/preflight command that separates source readiness from live-device readiness.
- Semantic UI adapter based on accessibility identity first, OCR/pixels second.
- Agent adapters: Hermes-native first for the owner's stack, MCP as the optional generic bridge.
- Dockerized Linux control plane with PostgreSQL, persistent canonical media/config and authenticated macOS device-worker gateways.

## Non-goals for v1

- Replacing WebDriverAgent/Appium merely for novelty.
- Coupling the scheduler to a particular LLM, MCP client, or cloud provider.
- Automatic CAPTCHA/login-wall bypass, credential discovery, platform-ban evasion, identity spoofing, or fake-account creation.
- Unbounded mass messaging or engagement. High-impact public/send actions need explicit task intent and policy gates.
- Replacing the live video stack before a real-device benchmark proves a better transport.

## Success criteria

1. `npm run check` is green from a clean install.
2. `npm run doctor` tells the truth about every host prerequisite.
3. A fleet API returns all configured accounts without leaking secrets.
4. A scheduled task with an unconfigured account is rejected before persistence.
5. A live acceptance run can prove registration → WDA → stream → touch → account switch → scheduled task on a physical iPhone.
6. Agent/semantic automation can be added without changing scheduler contracts.
7. The MiniPC can remain online with a Mac worker offline and automatically recover its device inventory/configuration when that worker reconnects.
