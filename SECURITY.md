# Security Policy

Do not report vulnerabilities through public issues. Until a dedicated address is configured, contact the repository owners privately through the GitHub organization.

Never attach a self-hosted production runner to this repository's workflows. Never include device passcodes, Apple signing material, real UDIDs, authentication tokens, screenshots, uploaded media, or production logs in an issue or pull request.

## Dependency audit boundaries

The MiniPC control-plane release installs production dependencies only. Use
`npm audit --omit=dev` as the production dependency gate and treat any non-zero
result as a release blocker.

macOS execution workers intentionally install the repository's Appium tooling as
well. The optional physical-iPhone lane still depends on the legacy Appium 2
toolchain for compatibility with its WDA recipes, while the Simulator lane uses
the isolated Appium 3 runtime. Do **not** apply `npm audit fix --force` merely to
silence legacy-tooling advisories: npm currently resolves those findings by a
breaking Appium major upgrade. Upgrade that lane only with physical-device WDA
compatibility tests and the normal worker readiness gates. A simulator-only
worker should keep `PHONE_FARM_ENABLE_PHYSICAL_IOS=false`, which prevents the
legacy Appium/WDA services from being installed or started.
