# GimmeABreak

Employee leave planning and clinical-manager coordination, built from the supplied workforce archive and official WA Health policy documents.

## Run

```powershell
npm install
npm run build
$env:PORT=3002
npm start
```

Open http://127.0.0.1:3002. Development: `npm run dev`.

## Connected assistant

Copy `.env.example` to `.env.local` and configure the server variables described in [Foundry setup](docs/foundry-assistant.md). Credentials must never be placed in browser code. The assistant reports an unavailable connection when configuration is missing.

The backend queries a read-only database containing **900,095 retained records from 945,381 source rows** across all four synthetic workforce CSVs. Balances, rosters and profiles use this full database; swap matching explicitly uses the validated candidate extract. See [full data provenance](docs/full-data.md). The compressed database is included only in server functions.

Tool activity is visible in the chat panel. Requests require an explicit confirmation click; the model cannot approve leave or contact colleagues. Employee and manager views automatically select signed synthetic-role sessions without access codes. The public application is currently open for demonstration; this is not organizational identity management.

## Workflow

- **My leave:** source-backed annual, personal and long service balances; accrued/booked breakdown and local request reservations.
- **Request leave:** select actual roster dates for 21 September–4 October 2026, leave type and a manager note.
- **Booking popup:** visible balance, roster, policy, skill-mix and coordination checks, with source links.
- **Suggestions:** same-role/grade cover or equal-hour bilateral swaps. Both schedules are checked for roster/leave overlap, contract dates, hours, conditional rest, duty counts and full days off. Cross-ward suggestions retain competency checks for the manager. Swaps replace paid leave hours rather than deducting leave for a worked replacement duty.
- **Colleague coordination:** clearly identified local response preview. No external message is sent. The manager confirms actual agreement.
- **Clinical manager view:** separate department roster, historical scheduled staffing context, role mix and leave-request queue. Approval requires explicit clinical verification; decline and changes require reasons. Approved local changes appear in projected department counts.
- **My requests:** local status and decisions persist across refresh. Annual-leave response deadlines start when submitted, with the ANF 14-day rule.
- **Resources:** field/source lineage and indexed policy clauses. No generic staffing score or automatic leave decisions.

## Data

`scripts/build_workforce_data.py` processes every row of the four CSVs in `OneDrive_2026-09-18.zip`. The browser loads a bounded department/candidate extract: 232 employee records, 950 balance records, 2,760 roster records and 145 leave records, plus 56 days of descriptive staffing context. Source row identifiers are retained. Requester SYN008078 is displayed as Sarah Chen, a Registered Nurse with nine duties and 72 rostered hours. Names are presentation aliases, not source identities.

Balances are selected as of 19 September; current requester snapshots are 17 September. Invalid contract ends remain unresolved and cannot be silently treated as permanent contracts. Industrial instruments are inferred from recorded roles, explicitly unverified. Historical role uncertainty is recorded in the quality profile.

See `docs/workforce-data-profile.md` for exact ingestion scope and quality limitations.

## Policies and checks

`scripts/fetch_policies.py` retrieves official sources. `data/policies/` holds nine PDFs, page-marked text and SHA256 provenance; `src/data/policies.json` indexes eleven source entries including ANF, UWU, AMA, ratios, AI policy/standard and accrued leave.

The active matching workflow is nursing/ANF. Other instruments are indexed but do not inherit nursing rules. The rest checker applies 20 hours to day/night transitions; a conservative 9.5-hour floor otherwise is an application filter, not a universal agreement clause. It uses ordinary roster limits without assuming undocumented exceptions.

The dataset lacks patient census, acuity, direct-care/HFSC designations and verified competencies/ward-policy mapping. Preserved headcount is not certified nurse-patient ratio compliance. ED historical scheduled counts remain descriptive context. Excess leave is a preserved source flag, not a made-up hours threshold.

See `docs/policy-evidence.md` for source clauses and applicability.

## Boundaries

The Foundry assistant uses server-side model tool calls and a signed synthetic-role session for employee SYN008078. Confirmed assistant and calendar requests, manager decisions, and leave-plan invitations persist in private Azure Table Storage. Unsubmitted calendar drafts remain in browser storage. External messaging, live roster writeback, payroll and HSS integration are not connected. Colleague responses remain previews; manager approval requires clinical verification.

## Department leave planning

The manager calendar shows employees as rows and dates across each month, with coloured leave spans, filters and balance/history drawers. Department membership combines current home-unit contracts and fortnight roster assignments; it is an inferred membership, not an authoritative reporting hierarchy. History separates safely summable past Leave Taken records from future/booked records. Missing previous-year records mean unknown, not zero leave. Personal leave is descriptive and never a negative fairness score.

Leave planning preserves source excess flags for manager review. Suggested annual or long-service dates use actual roster hours, balances, recorded absences and saved requests. Options rank recorded impact and show projected balances and daily same-role assignment counts. These counts do not establish shift coverage or nurse-patient ratio compliance. Suggestions are first steps toward an agreed plan, not certification that an employee becomes compliant.

Managers can send an in-app planning invitation; the employee can discuss it or select suggested dates for a new request. This does not send email or approve leave. The current employee sign-in represents Sarah; invitations for other synthetic employees are stored but require future identity mapping for their own sign-in.

Chat answers offer context-specific buttons, including alternative dates and shift options. When booked leave overlaps, a cancellation-watch card can be added locally. It is explicitly a cosmetic preview: no monitoring runs and no notifications are sent.

The app can propose one colleague arrangement per request; remaining affected shifts are explicitly retained for manager review. Matching reserves proposed colleagues and return dates to avoid reuse by another active local request. Real workforce deployment requires Entra employee identity mapping, approved communications, locally validated industrial applicability and clinical inputs.

## Verification

```powershell
npm run typecheck
npm test -- --reporter=dot
npm run build
```

Tests cover current-versus-future balances, overnight overlap, bilateral swaps, role/instrument restrictions, rest transitions, request reservations, declined colleague handling, submission timing and manager verification/projected rosters.

The clinical manager navigation includes Staffing requirements: ten role sliders, day/evening/night windows and shift/day/fortnight bulk application. Plans persist on the current device, keyed by department and fortnight. The on-page comparison uses the imported roster snapshot; these settings do not yet change server-side chatbot checks or approval decisions. Agent workflows remains excluded from the main app.
