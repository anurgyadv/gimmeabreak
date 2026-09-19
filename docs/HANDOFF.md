# CoverAssist Handoff

## Delivered experience

The root route is a single interactive story built for a live hackathon presentation:

1. A fixed leave request for `SYN001597`.
2. A staged deterministic-analysis animation.
3. An evidence summary for the affected `SU0325` ED shift.
4. Manager review of `SYN000894` and `SYN001237`.
5. A guarded human selection and decision.
6. A simulated Microsoft Teams coordination card.

An always-visible Ask the Evidence panel answers likely judge questions. The Data and demo guide route explains provenance and boundaries.

## Data preparation

`scripts/prepare_demo_data.py` streams the four supplied CSV attachments from their current Temp paths. It profiles 945,381 rows, performs date and duplicate checks, calculates the golden path, and writes `src/data/coverassist-demo.json` plus its schema.

The runtime does not require the source CSVs. Re-running preparation does require restoring the files to the paths configured at the top of the script or changing those path constants.

## Key evidence

- `SYN001597` has booked annual leave and an overlapping 07:00–15:30 `SU0325` shift on 21 September 2026.
- The shift is eight net hours after a 30-minute meal break.
- Three clinicians pass hard candidate filters. The two shown have the most prior scheduled shifts in `SU0325`.
- `SYN000894`: 48 prior shifts, 71.5 current hours, 79.5 projected hours.
- `SYN001237`: 40 prior shifts, 71.5 current hours, 79.5 projected hours.
- The annual-leave balance is unavailable at the 18 September decision date because the supplied snapshot is effective 1 October.
- Policy rule text was not supplied, so staffing, fatigue and credential checks remain unknown.

## Verification evidence

- Dataset generation passed on 19 September 2026 and returned the two scripted candidates.
- `npm run typecheck` passed on 19 September 2026.
- `npm run build` passed on 19 September 2026; all routes were statically generated.
- Browser walkthrough passed: request, analysis, evidence summary, manager gate, candidate selection, coordination card and data guide.
- Automated tests were intentionally deferred at the user's request.

## Local preview

`npm start` serves the current static build at http://127.0.0.1:3001. Re-run `npm run build` after source changes.

## Deferred production work

FastAPI or equivalent backend, governed database, authentication, verified policy-rule configuration, live Teams integration, Azure deployment, production HR writes and automated tests remain outside this demo increment.
