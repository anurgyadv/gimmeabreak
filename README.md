# CoverAssist

CoverAssist is an interactive hackathon demonstration of clinician leave impact analysis. It uses the structure and records from the supplied synthetic contracts, leave-balance, leave-history and roster files to tell one reliable user story:

> Request leave → analyse operational impact → review evidence → coordinate cover

The demo is deliberately focused. A preparation script streams 945,381 source rows and packages a small derived JSON file containing the golden-path evidence. The browser performs the scripted interaction locally, so judging does not depend on a network connection, live AI service or Microsoft tenant.

## Run the demo

Requires Node.js 20.9 or newer.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000.

For a production-style static build:

```sh
npm run build
npm start
```

Open http://127.0.0.1:3001.

## Scripted user story

1. `SYN001597`, a Resident Medical Officer, requests eight hours of annual leave on 21 September 2026.
2. Select **Check my leave**. The interface visibly follows employee, balance, roster, coverage, candidate and policy checks.
3. The result identifies one affected 07:00–15:30 shift in `SU0325`, Synthetic Emergency Department.
4. The balance result remains unavailable because the supplied annual-leave snapshot is effective after the 18 September decision date.
5. Open manager review. Three clinicians pass the hard filters; the demo shows the two with the most prior scheduled `SU0325` shifts.
6. Select `SYN000894` or `SYN001237`. Each has 71.5 rostered pay-period hours and reaches 79.5 of 80 hours after the eight-hour shift.
7. Select **Approve and coordinate** to produce the simulated Teams message.
8. Use **Ask the evidence** throughout to answer likely judging questions.

## Logic behind the story

The data-preparation script:

- preserves source headers and row counts;
- removes exact duplicates from matching logic;
- validates dates without coercing malformed years;
- trims roster work codes;
- calculates overnight and meal-break-adjusted shift hours;
- prevents leave-balance look-ahead;
- matches active contracts by occupational group, role and rate;
- excludes roster and booked-leave conflicts;
- calculates pay-period hours and prior unit experience;
- excludes age, gender and free-text reasons from matching.

Regenerate the derived dataset on the original machine with:

```sh
C:\Users\Anurag\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe scripts\prepare_demo_data.py
```

The source attachment paths are defined near the top of `scripts/prepare_demo_data.py`. The runtime uses only `src/data/coverassist-demo.json`; the full CSV files are not committed or shipped.

## Important boundaries

- This is decision support, not automated leave approval.
- Candidate cards are eligible options, not a definitive “best person” ranking.
- Missing staffing, fatigue, credential and award rule text remains visibly unknown.
- The demo does not claim that a roster is clinically safe.
- AI explanation and Teams coordination are simulated.
- The architecture is compatible with future FastAPI, governed workforce data, Microsoft Entra, Teams and Azure integration, but those services are not required for this demo.

Automated test development is intentionally deferred. Current verification covers dataset regeneration, TypeScript, the static production build and a manual browser walkthrough of the complete story.
