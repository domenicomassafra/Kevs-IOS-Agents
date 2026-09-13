# Donor/research matrix — 2026-09-13

| Candidate | Best use | Strengths | Constraints / why not core | Decision |
| --- | --- | --- | --- | --- |
| Kevs-IOS-Agents (current) | Fleet + social workflow core | Physical iPhone, registration, WDA/Appium supervision, Postgres scheduler, TikTok + Instagram, fleet pipelines, Hinge research | Young project; needs stronger semantic agent layer | **KEEP AS CORE** |
| Git-Agni/prod-FARM-IOS-Core | Lineage/upstream reference | ~same architecture, wider adoption, Apache-2.0 | Public main is behind current Kevin feature branch for our needs | Track as lineage/reference |
| ghost-in-the-droid/android-agent @ 7c09f6c | Agent/skill architecture | iOS WDA, normalized screen tree, skills, MCP, bot runner, multi-device jobs, swappable brains | Duplicates scheduler/dashboard; Python stack; importing whole project creates two control planes | **DONOR: semantic/skill ideas** |
| Oceanswave/hermes-iphone-plugin @ bc25eba | Owner-facing agent adapter | Native Hermes tools, pymobiledevice3, semantic tree, WDA self-heal, redacted traces | Not a fleet scheduler | **PREFERRED HERMES ADAPTER DONOR** |
| teddyoweh/iphone-mcp @ bc793d7 | Semantic snapshot design | Real iPhone, compact accessibility snapshots, stable refs, low token use | Single-purpose MCP; no fleet scheduler | **DONOR: snapshot/ref model** |
| ZSeven-W/dsh-ios @ a913c2e | WDA lifecycle/security/testing | Real-iPhone WDA staging, coded failures, signed stream routes, extensive smoke tests | DSH-specific host/panel model | **DONOR: lifecycle + safety + tests** |
| Appium Device Farm | Allocation/topology reference | Mature Appium multi-device sessions, dashboard, hub/node scaling | Manual stream/control removed because WDA streaming competed with automation | Reference only |
| LWHikarik/device-farm-ios | Video transport experiment | qvh/H.264 video separated from modern Appium control; multi-device iOS 26.5 claim | Fork/experimental; extra native bridge dependency | **BENCHMARK DONOR, not default** |
| GADS | Generic lab/device farm | iOS/Android, reservations/workspaces, remote control | Mixed AGPL/proprietary UI; QA-centric | Reference only |
| Baguette | UX/performance inspiration | Excellent simulator streaming/farm UI/accessibility | Simulator-first, not physical-iPhone fleet | UX reference only |
| iPhone Mirroring MCPs | Quick single-phone agent demo | No WDA signing, easy local control | Apple's Mirroring is one-phone-at-a-time and session-sensitive; poor fleet basis | Reject as core |
| minitap/mobile-use | General agent research | Agentic mobile UI model, modern setup skill | Public docs are inconsistent on physical-iOS maturity | Watch, don't adopt |
| pymobiledevice3 | Device-management substrate | Modern Apple protocol coverage, DVT, tunneling, WDA helpers | GPL-3.0 library implications; not a scheduler/UI | Prefer via isolated adapter / Hermes donor |

## Synthesis

The best solution is **compositional, not a mega-merge**. Keep one authoritative fleet scheduler. Borrow semantic targeting, lifecycle recovery, trace discipline and eventually video transport behind narrow interfaces. A deterministic recipe remains the default for known social workflows; an agent is invoked only where semantic exploration or novel intent adds value.

## Donor provenance

Bounded local clones live under `../donors/` and are not vendored into this repository. Their pinned research heads are recorded above. Any later code adaptation must preserve the upstream license/notice and document the exact imported surface.
