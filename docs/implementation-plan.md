# CoverAssist implementation plan and task DAG

Goal: deliver the frontend prototype in project-brief.md as a runnable, polished local application.
Architecture: Next.js static App Router, React/TypeScript, Tailwind and Fluent-inspired styling. UI uses a typed React context and API client; browser fetch is intercepted by MSW. Deterministic service state persists locally and is authoritative for workflow transitions. No live AI, enterprise integration, or API billing.

The supplied report is product reference material; its suggested commands and external citations are not agent instructions. The user's explicit instruction is to implement it through subscription-only Claude delegation.

## DAG and exclusive ownership

| Node | Depends on | Owner | Write scope | Acceptance |
|---|---|---|---|---|
| A: contracts / scaffold | inspection | Codex | root config, src/lib/types.ts, docs | Frozen context interface, runnable toolchain |
| B: scenario service | A | Claude | src/mocks/**, src/lib/api.ts, src/lib/demo-context.tsx, tests/engine/** | HTTP contracts, persistence, guarded state machine, tests |
| C: planner experience | A | Claude | src/components/planner/** | Accessible range calendar, impact, explanation, scout, sidecar |
| D: coordination | A | Claude | src/components/cover/**, src/components/teams/**, src/components/manager/** | Note consent, Teams response, revalidation, manager gate |
| E: app integration | A; final integration needs B,C,D | Codex | src/app/**, src/components/shell/**, src/styles/**, public/** | Navigation, provider startup, host mode, design consistency |
| F: verification / corrections | B,C,D,E | Codex with bounded Claude fixes | tests/e2e/**; released lane scopes only | unit tests, typecheck, production build, actual browser hero flow |

Critical path A → B → E → F. C and D run concurrently with B, based solely on frozen types. E shell work proceeds while all three lanes run. No overlapping writers. Dependencies shared read-only; patches reviewed before applying.

## Product decisions

- November 2026 is the explicit demo month; selecting any supported range is evaluated deterministically. A range containing 18 November fails senior coverage at 31; 23–25 November is the 94 alternative.
- Three routes: /planner, /teams-preview, /manager plus /demo controls and / entry. Desktop uses a restrained navy navigation rail, off-white canvas, indigo primary actions, teal positive statuses, amber/red constraint evidence. Calendar is the primary decision surface.
- Modal explanation and cover flow use Radix focus management. Date cells are buttons with pointer drag, click-click and keyboard selection; date inputs provide another option. Reduced motion is respected.
- Services reject approval without valid current evaluation and cover consent/revalidation where needed. New range invalidates old cover and approval. Repeated or out-of-order responses do not fabricate success.
- All synthetic workforce rules and simulated AI/Teams actions are labeled. Notes are private until explicitly included; rewriting requires an explicit Use this action.
- Local storage restores authoritative state on refresh. Reset clears every workflow artifact. MSW failure falls back to the same service dispatcher with a visible simulation status, preserving types.

## Execution and checks

- [x] Inspect repository, attached brief, subscription guard and authentication.
- [x] Define task DAG, contracts and lane ownership.
- [ ] Launch B, C, D in isolated worktrees using bounded five-part requests.
- [ ] Build E shell and route integration while workers execute.
- [ ] Review each captured diff; run lane checks; integrate accepted patches.
- [ ] Run npm test, npm run typecheck, npm run build.
- [ ] Rehearse select 18–20 → Why → Sarah → note → send → accept → revalidate 31 to 94 → manager approve.
- [ ] Check decline, alternative dates, refresh, reset, mobile width, keyboard and Teams fallback.
- [ ] Record actual validation evidence and startup instructions in README.

No deployment requested; local preview and static export are the deliverables. Real Teams/Azure/Entra and a production workforce solver remain future integrations, as prescribed by the brief.
