# Data Driven CoverAssist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fictional calendar-first prototype with the updated blueprint's data-backed clinician leave analysis and human manager decision workflow.

**Architecture:** Keep the existing Next.js shell and accessibility patterns, add a FastAPI service backed by DuckDB, and place deterministic workforce tools behind a single analysis orchestrator. Seed only the documented golden-path records until the four source CSVs are supplied, while preserving an ingestion boundary for those files.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, CSS, FastAPI, Pydantic, DuckDB, Uvicorn

**Spec:** `docs/superpowers/specs/2026-09-19-data-driven-coverassist-design.md`

## Global Constraints

- Use `SYN001597` on 21 September 2026 as the primary demo request.
- Surface `SYN000894` and `SYN001237` as eligible options with transparent evidence; never claim either is definitively best.
- Do not use age, gender or personal-note text in matching.
- Return `unknown` for policy rules that are not backed by supplied rule text.
- Keep human approval and candidate selection explicit.
- Label the dataset as a blueprint-derived synthetic subset until the four real CSVs are supplied.
- Use no live LLM, API key, paid API credit, real Teams connector or production HR write.
- Preserve an offline templated explanation path and a reset action.
- Defer automated test authoring and test-suite execution at the user's request; still run import, typecheck, production build and manual smoke verification.
- Read relevant Next.js documentation in `node_modules/next/dist/docs/` before changing App Router or static export behavior.

## Review Focus

- Invalid or malformed dates must be rejected or quarantined, never silently coerced.
- A balance snapshot after the decision date must never be used.
- Overnight and meal-break shift arithmetic must produce one validated net duration.
- Candidate conflicts must exclude the person before ranking evidence is returned.
- Missing policy sources must remain `unknown` and must not block the UI from explaining what needs manager review.

---

### Task 1: Backend Runtime and Canonical Contracts

**Files:**
- Create: `api/requirements.txt`
- Create: `api/app/__init__.py`
- Create: `api/app/main.py`
- Create: `api/app/models.py`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: Pydantic request and response contracts used by every backend task.
- Produces: FastAPI application at `api.app.main:app` with `/api/health`.
- Consumes: none.

- [ ] **Step 1: Define dependencies and runtime commands**

Pin compatible ranges for `fastapi`, `uvicorn`, `duckdb` and `pydantic`. Add `api:dev` and `demo:dev` scripts without removing the existing frontend commands. Keep orchestration Windows-compatible.

- [ ] **Step 2: Define canonical API models**

Create focused models including:

```python
class LeaveAnalysisRequest(BaseModel):
    employee_id: str
    leave_type: str
    start_date: date
    end_date: date
    decision_date: date
    requested_hours: float | None = None

class CandidateEvidence(BaseModel):
    employee_id: str
    role: str
    rate_id: str
    contract_hours: float
    current_pay_period_hours: float
    projected_pay_period_hours: float
    roster_conflict: bool
    leave_conflict: bool
    home_unit: str
    prior_unit_shift_count: int
    last_worked_in_unit: date | None
```

The aggregate response must include `request`, `employee`, `balance`, `affected_shifts`, `coverage_impacts`, `candidates`, `policy_checks`, `warnings` and `provenance`.

- [ ] **Step 3: Add application startup and health contract**

Create the FastAPI app, development CORS for `127.0.0.1:3000`, lifespan database initialization, structured error responses and `GET /api/health` returning dataset mode and database readiness.

- [ ] **Step 4: Run backend import smoke check**

Run the bundled Python executable with `-c "from api.app.main import app; print(app.title)"`. Expected: the app imports without side effects or tracebacks.

- [ ] **Step 5: Commit the backend contract**

Commit only Task 1 files with message `feat: add data driven api contracts`.

### Task 2: DuckDB Ingestion and Blueprint Seed Dataset

**Files:**
- Create: `api/app/db.py`
- Create: `api/app/ingestion.py`
- Create: `api/app/seed_data.py`
- Create: `api/data/.gitkeep`
- Create: `scripts/prepare_data.py`
- Modify: `api/app/main.py`

**Interfaces:**
- Consumes: `api.app.models` date and provenance conventions.
- Produces: `get_connection()`, `initialize_database()`, `prepare_blueprint_seed()` and `prepare_csv_dataset(paths)`.

- [ ] **Step 1: Create one DuckDB connection boundary**

Use a configurable path defaulting to `api/data/workforce.duckdb`. Centralize schema creation for `employee_position`, `leave_balance`, `leave_record`, `roster_shift`, `unit_experience`, `data_quality_issue` and `demo_state`.

- [ ] **Step 2: Encode the documented seed facts**

Seed only facts stated in the blueprint: the golden employee, affected shift, annual-leave record, two candidate employees, 71.5 current pay-period hours, projected 79.5 hours, and prior-unit shift counts 48 and 40. Add synthetic display names only when visibly labelled as demo aliases; do not invent policy compliance.

- [ ] **Step 3: Implement reusable CSV normalization**

Create helpers that trim codes, deduplicate exact rows, parse dates with a 1900–2100 year bound, quarantine invalid rows, select the latest balance where `effective_date <= decision_date`, and calculate net hours with overnight handling and one meal-break subtraction.

- [ ] **Step 4: Add the preparation command**

`scripts/prepare_data.py` accepts optional paths for contracts, balances, leave and rosters. When none are passed it loads the blueprint seed and records provenance `blueprint-golden-v1`. When all four are passed it loads the real dataset and reports accepted, duplicate and quarantined counts.

- [ ] **Step 5: Run the preparation smoke check**

Run `python scripts/prepare_data.py` and query counts for all canonical tables. Expected: the command reports blueprint seed mode and all golden identifiers are queryable.

- [ ] **Step 6: Commit ingestion**

Commit Task 2 files with message `feat: add duckdb workforce ingestion`.

### Task 3: Deterministic Workforce Tools

**Files:**
- Create: `api/app/tools/__init__.py`
- Create: `api/app/tools/employee.py`
- Create: `api/app/tools/balances.py`
- Create: `api/app/tools/roster.py`
- Create: `api/app/tools/coverage.py`
- Create: `api/app/tools/candidates.py`
- Create: `api/app/tools/policies.py`

**Interfaces:**
- Consumes: canonical DuckDB tables and Pydantic evidence models.
- Produces: the eight deterministic tool functions named in the design spec.

- [ ] **Step 1: Implement employee and balance evidence**

Resolve the active position on the decision date. If multiple rows remain ambiguous, return a warning. Balance lookup must never look forward and must return unavailable rather than fabricate a value.

- [ ] **Step 2: Implement affected-shift and duration evidence**

Find every shift intersecting the leave date range. Calculate the documented 07:00–15:30 shift minus 30 minutes as 8.0 hours. Return unit, pay period, work code and duration provenance.

- [ ] **Step 3: Implement coverage evidence**

Describe the role removed from the shift and the resulting operational gap. Do not emit safe, unsafe or compliant unless an explicit rule supports that word.

- [ ] **Step 4: Implement hard candidate filters**

Filter active candidates by occupational group, role and rate, then exclude leave conflicts and overlapping roster shifts. Calculate current and projected pay-period hours and attach prior-unit experience.

- [ ] **Step 5: Implement policy outcomes**

Return a deterministic balance-context result where evidence exists. Return `unknown` for staffing ratios, fatigue, credentials and other rules whose text is not supplied, with `source_reference: null` and `requires_manager_review: true`.

- [ ] **Step 6: Run a golden query smoke check**

Execute the functions for `SYN001597` and assert interactively that the affected shift is `SU0325`, net hours are 8.0, and candidate IDs are exactly `SYN000894` and `SYN001237` with projected hours 79.5.

- [ ] **Step 7: Commit workforce tools**

Commit Task 3 files with message `feat: add deterministic workforce tools`.

### Task 4: Analysis Orchestration and Decision API

**Files:**
- Create: `api/app/orchestrator.py`
- Create: `api/app/explanations.py`
- Create: `api/app/state.py`
- Modify: `api/app/main.py`

**Interfaces:**
- Consumes: all deterministic tool functions.
- Produces: `analyse_leave(request) -> LeaveAnalysisResponse` and state transitions for analyse, select candidate, decide and reset.

- [ ] **Step 1: Implement ordered analysis**

Sequence employee context, balance, affected shifts, coverage, candidates and policies. Record stage names for the UI and stop with actionable structured errors when the employee or request dates cannot be resolved.

- [ ] **Step 2: Implement evidence-backed explanation**

Generate a concise paragraph solely from response fields. For the golden path it must state one affected 07:00–15:30 RMO shift, two eligible options, prior unit experience, no detected conflicts and projected 79.5/80 hours, followed by manager review.

- [ ] **Step 3: Implement human decision state**

Persist current analysis, selected candidate, decision and audit events in `demo_state`. Reject candidate selection when the candidate is not in the current eligible set. Do not expose an AI approval endpoint.

- [ ] **Step 4: Expose HTTP routes**

Add:

```text
POST /api/leave/analyse
POST /api/agent/explain
POST /api/requests/{analysis_id}/select-candidate
POST /api/requests/{analysis_id}/decision
GET  /api/employees/{employee_id}
GET  /api/demo/state
POST /api/demo/reset
```

- [ ] **Step 5: Run HTTP smoke checks**

Start Uvicorn, call health, analyse the golden request, select one returned candidate, record a manager action, read state, reset, and confirm state is empty. Save no external messages.

- [ ] **Step 6: Commit API orchestration**

Commit Task 4 files with message `feat: add leave analysis orchestration`.

### Task 5: Frontend Contracts and Data Client

**Files:**
- Replace: `src/lib/types.ts`
- Replace: `src/lib/api.ts`
- Create: `src/lib/analysis-context.tsx`
- Modify: `src/app/layout.tsx`
- Remove after migration: `src/lib/demo-context.tsx`
- Remove after migration: `src/mocks/**`

**Interfaces:**
- Consumes: FastAPI JSON contracts.
- Produces: `AnalysisProvider` with `analyse`, `selectCandidate`, `decide`, `reset`, loading stages, error and current state.

- [ ] **Step 1: Mirror backend contracts in TypeScript**

Use discriminated policy results (`pass | fail | unknown`) and explicit provenance. Do not include age or gender fields. Keep dates as ISO strings at the HTTP boundary.

- [ ] **Step 2: Create configurable API transport**

Read `NEXT_PUBLIC_API_BASE_URL`, default to `http://127.0.0.1:8000/api`, parse structured backend errors and use an `AbortController` for superseded analyses.

- [ ] **Step 3: Create application state**

Load demo state on startup, expose real analysis stages, invalidate stale selection after a new analysis, and reset both frontend and backend state.

- [ ] **Step 4: Remove MSW only after all consumers migrate**

Keep the old files until every route uses `AnalysisProvider`; then remove the worker registration and obsolete fictional types so no split-brain path remains.

- [ ] **Step 5: Run TypeScript check**

Run `npm run typecheck`. Expected: zero errors.

- [ ] **Step 6: Commit client migration**

Commit Task 5 files with message `refactor: connect frontend to workforce api`.

### Task 6: Staff Leave Request and Analysis Experience

**Files:**
- Create: `src/components/request/LeaveRequestPage.tsx`
- Create: `src/components/request/LeaveRequestForm.tsx`
- Create: `src/components/request/AnalysisProgress.tsx`
- Create: `src/components/request/ImpactSummary.tsx`
- Create: `src/components/request/request.css`
- Modify: `src/app/page.tsx`
- Modify: `src/app/planner/page.tsx`

**Interfaces:**
- Consumes: `AnalysisProvider.analyse` and `LeaveAnalysisResponse`.
- Produces: the complete staff-facing check flow and a link to manager review.

- [ ] **Step 1: Build the golden request form**

Default employee to `SYN001597`, annual leave, 21 September 2026 and decision date 18 September 2026. Allow edits, validate locally, keep the personal note optional and state that it is excluded from matching.

- [ ] **Step 2: Tie progress animation to real stages**

Show "Checking your roster", "Checking leave balance", "Examining team coverage", "Finding compatible coverage options" and "Reviewing workforce rules" only as the corresponding backend result becomes available or while the single request is pending.

- [ ] **Step 3: Build the staff impact summary**

Show balance availability and provenance, affected shift, operational gap, candidate count, warnings and next action. Use neutral language for unknown policy evidence.

- [ ] **Step 4: Preserve responsive and accessible interaction**

Use labelled controls, visible focus, status live regions, reduced-motion support and no color-only status. Reuse shell tokens rather than copy old planner layout blindly.

- [ ] **Step 5: Run frontend build**

Run `npm run typecheck` then `npm run build`. Expected: both succeed and the request route is statically generated.

- [ ] **Step 6: Commit staff flow**

Commit Task 6 files with message `feat: add evidence backed leave request flow`.

### Task 7: Manager Evidence Review and Human Decision

**Files:**
- Replace: `src/components/manager/ManagerDashboard.tsx`
- Replace: `src/components/manager/manager.css`
- Create: `src/components/manager/AffectedShiftCard.tsx`
- Create: `src/components/manager/CandidateEvidenceCard.tsx`
- Create: `src/components/manager/PolicyCheckCard.tsx`
- Modify: `src/app/manager/page.tsx`

**Interfaces:**
- Consumes: current `LeaveAnalysisResponse`, `selectCandidate` and `decide`.
- Produces: transparent manager review and guarded decision actions.

- [ ] **Step 1: Present request and entitlement provenance**

Show employee, leave dates, optional note, decision date, balance effective date, remaining hours and data version. Distinguish unavailable evidence from zero.

- [ ] **Step 2: Present every affected shift**

Show unit, start/end, meal break, net hours, role/rate context and coverage consequence without a clinical-safety claim.

- [ ] **Step 3: Present comparable candidate evidence**

Render cards for `SYN000894` and `SYN001237` with role/rate, conflict results, 71.5 current hours, 79.5 projected hours, contract hours, prior-unit shift count and last-worked context. Use "Select option", not "Choose best".

- [ ] **Step 4: Present rules and uncertainty**

Visually distinguish pass, fail and unknown. Unknown cards explain that verified policy text is required and keep manager review available.

- [ ] **Step 5: Guard manager actions**

Offer approve, approve and initiate coverage, request changes and decline. Coverage initiation requires a selected current candidate; all actions append a visible audit event.

- [ ] **Step 6: Run build check**

Run `npm run typecheck` and `npm run build`. Expected: both succeed.

- [ ] **Step 7: Commit manager review**

Commit Task 7 files with message `feat: add manager evidence review`.

### Task 8: Simulated Coordination, Demo Reset and Handoff

**Files:**
- Replace: `src/components/teams/TeamsPreview.tsx`
- Replace: `src/components/teams/teams.css`
- Replace: `src/app/demo/page.tsx`
- Modify: `src/components/shell/AppShell.tsx`
- Modify: `src/styles/globals.css`
- Modify: `README.md`
- Modify: `docs/HANDOFF.md`
- Create: `scripts/run-demo.ps1`

**Interfaces:**
- Consumes: selected candidate, decision and audit state.
- Produces: labelled Teams-style coordination preview, one-command local startup, reset and handoff instructions.

- [ ] **Step 1: Replace the fictional Teams card**

Show the actual affected `SU0325` shift, selected candidate ID, evidence summary and manager action. Label the surface "Simulated Teams coordination" and never imply delivery.

- [ ] **Step 2: Rebuild the demo control page**

Show the three-minute judging sequence, active dataset mode, backend health, reset control and the exact golden identifiers. Remove November/Sarah-specific controls.

- [ ] **Step 3: Add a local launcher**

Create a PowerShell script that prepares DuckDB, starts Uvicorn on 8000 and Next on 3000, reports both URLs and cleans up child processes when interrupted.

- [ ] **Step 4: Update documentation**

Document dependency setup, the seed-data limitation, how to provide the four real CSVs, architecture boundaries, startup commands, demo steps, exclusions and troubleshooting.

- [ ] **Step 5: Perform final non-test verification**

Run backend import and preparation smoke checks, `npm run typecheck`, `npm run build`, then manually walk request → analysis → manager candidate selection → decision → Teams preview → reset at desktop and narrow viewport. Record exact command results in `docs/HANDOFF.md`.

- [ ] **Step 6: Commit the complete demo**

Commit Task 8 files with message `feat: complete data driven coverassist demo`.

## Deferred Follow Up

Automated unit, integration and browser tests remain intentionally deferred. When the user resumes testing, begin with malformed dates, duplicate rows, look-ahead balances, overnight shifts, leave/roster candidate conflicts, demographic-field absence, golden-path output and decision-state guards.
