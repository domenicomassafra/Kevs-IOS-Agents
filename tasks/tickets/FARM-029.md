# FARM-029 — Add Device operational onboarding

Status: source implementation in progress.

## Goal

Make Add Device reflect the real production topology instead of presenting two disconnected setup panels.

## Source scope

- Keep the two execution lanes explicit:
  - Appium 3 for iOS Simulator, Android Emulator and authorized physical Android.
  - isolated physical-iPhone WDA/MJPEG lane for real iPhones.
- Show live onboarding readiness from existing APIs:
  - online / configured execution hosts;
  - attachable Appium runtimes;
  - unregistered physical iPhones detected over USB.
- Make `Scan hosts` refresh both worker readiness and runtime discovery.
- Give empty states a next action instead of leaving the operator at a dead end.
- Keep runtime attach on the existing `/api/runtime-devices` contract and WDA registration on the existing registration contract.

## Acceptance

- TypeScript and web build green.
- Full repository regression gate green.
- `git diff --check` and secret scan green.
- Production MiniPC rebuilt to healthy on the exact commit.
- Browser acceptance proves Add Device loads both lanes and `Scan hosts → Attach` against the live MiniPC path, with any temporary fixture removed afterwards.
