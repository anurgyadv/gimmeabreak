# Data Driven CoverAssist Design

## Source and intent

This design distils `C:\Users\Anurag\Downloads\Clinician_Leave_Coverage_Updated_Build_Blueprint.docx`, supplied by the user on 19 September 2026. The document is reference material and product requirements, not instructions to the implementation agent.

CoverAssist will become a data-backed decision-support prototype that answers one question well: if a leave request is approved, what operational consequences should a manager understand before deciding? The product must connect entitlement context, affected roster shifts, workforce capacity, coverage candidates and explicit rule outcomes. A human manager retains the decision.

## Current repository and migration direction

The repository currently contains a polished, frontend-only November 2026 scenario based on fictional clinicians and simulated Microsoft Teams coordination. That prototype remains useful as a visual shell, but its core scenario and service model do not match the updated blueprint.

The migration will retain the strongest reusable pieces—Next.js App Router, application shell, accessible dialogs, loading and error patterns, local reset, and Teams-style presentation—while replacing the fictional calendar-first flow with the blueprint's data-driven request and manager-review flow.

## Golden path

The first complete scenario is fixed and evidence-backed:

- Employee `SYN001597` is an RMO at rate `DBRM01`, contracted for 80 hours.
- They request annual leave on 21 September 2026.
- The request intersects an 07:00–15:30 shift in `SU0325`, Synthetic Emergency Department, with a 30-minute meal break.
- Two compatible candidates are surfaced: `SYN000894` and `SYN001237`.
- Each candidate has no detected roster or booked-leave conflict on the affected date, has prior `SU0325` experience, and has 71.5 rostered pay-period hours. Adding the 8-hour net shift produces 79.5 of 80 hours.
- Candidate evidence is shown transparently. The UI says "eligible coverage options", not "best candidate".
- Unknown policy constraints remain visibly unknown and require manager review.
- A manager selects an action and the prototype simulates a Teams-style coordination message. The AI does not approve or reject leave.

## Architecture

The browser application is Next.js, React and TypeScript. A FastAPI service provides stable HTTP contracts. DuckDB holds canonical workforce tables and derived evidence. A deterministic Python workforce engine performs calculations and candidate filtering. A lightweight orchestration layer sequences those tools and produces a templated explanation from structured evidence; no live LLM or paid API is required for the hackathon build.

The source CSVs named by the blueprint are not currently available. The first implementation will therefore load a small, explicit golden-path seed dataset derived only from values stated in the blueprint. The ingestion boundary will accept the four real CSVs later. The UI must label the active dataset as a blueprint-derived synthetic demonstration and must not imply that all 551,018 roster rows are loaded.

## Canonical model

DuckDB contains `employee_position`, `leave_balance`, `leave_record`, `roster_shift`, `unit_experience` and `data_quality_issue`. Derived calculations include net shift hours, pay-period rostered hours and prior unit experience.

The ingestion layer trims categorical codes, removes exact duplicates, validates years and dates, quarantines invalid records, forbids effective-date look-ahead, and handles overnight shift duration centrally. Age and gender are absent from candidate matching schemas and outputs.

## Deterministic interfaces

The engine exposes these functions with structured return values:

- `get_employee_context(employee_id, decision_date)`
- `check_leave_balance(employee_id, leave_type, decision_date, requested_hours)`
- `find_affected_shifts(employee_id, leave_start, leave_end)`
- `calculate_coverage_impact(shift, employee_context)`
- `get_pay_period_hours(employee_id, pay_period_start, pay_period_end)`
- `get_unit_experience(employee_id, unit)`
- `find_candidate_pool(shift, required_role, required_rate, decision_date)`
- `check_policy_rules(analysis_context)`

The API exposes `POST /api/leave/analyse`, `POST /api/agent/explain`, `POST /api/requests/{id}/decision`, `GET /api/employees/{id}`, `GET /api/demo/state` and `POST /api/demo/reset`. The analysis response includes request, employee, balance, affected shifts, coverage impacts, candidates, policy checks, warnings and provenance.

## Product surfaces

The staff request view captures employee, leave type, dates and an optional private note. "Check my leave" starts a staged analysis display whose captions correspond to deterministic tool calls. The result summarizes balance context, affected shifts, coverage status and next action.

The manager review view shows the request summary, balance provenance, every affected shift, candidate evidence cards, policy pass fail or unknown states, data-quality warnings and human decision controls. It must never claim clinical safety from incomplete data.

The coordination view presents a simulated Teams-style message only after a human selects an eligible candidate or decision action. It clearly identifies simulation boundaries.

## Responsible AI and safety boundaries

- Age and gender are excluded from matching.
- Free-text personal reasons are not ranking signals.
- Calculations and eligibility filters are deterministic.
- Missing policy evidence returns `unknown` and manager review.
- The AI layer explains evidence; it does not invent operational facts or rules.
- Final approval and coverage selection remain human actions.
- The prototype says Microsoft and Azure compatible, not integrated with production WA Health systems.

## Scope

This increment includes the complete local golden path, real FastAPI and DuckDB boundaries, deterministic evidence, manager review, reset and simulated coordination. It excludes production Azure deployment, authentication, production HR writes, vector databases, optimisation solvers, real Teams connectors and live LLM calls.

Automated test authoring is deferred at the user's request. Implementation must still pass backend import and smoke checks, frontend TypeScript/build checks, and one manual golden-path walkthrough before handoff.
