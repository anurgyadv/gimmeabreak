# CoverAssist Demo Data Profile

## Source footprint

| Source | Rows | Fields | Demo use |
|---|---:|---:|---|
| Employee details and contracts | 10,596 | 19 | Active position, role, rate, contract hours and home unit |
| Leave balances | 37,551 | 9 | Decision-date entitlement context with effective-date control |
| Leave taken and booked | 346,216 | 9 | Requested leave and candidate leave conflicts |
| Rosters | 551,018 | 11 | Affected shift, roster conflicts, pay-period hours and unit experience |

The four files contain 945,381 data rows in total. The browser ships an 8.5 KB derived evidence file rather than the full extracts.

## Golden path

- Requester: `SYN001597`
- Role and rate: Resident Medical Officer, `DBRM01`
- Contract hours: 80
- Home unit: `SU0460`
- Leave: booked annual leave on 21 September 2026 for eight hours
- Affected shift: `SU0325`, 07:00–15:30, 30-minute break, eight net hours
- Candidate `SYN000894`: 48 prior scheduled `SU0325` shifts; 71.5 current hours; 79.5 projected hours
- Candidate `SYN001237`: 40 prior scheduled `SU0325` shifts; 71.5 current hours; 79.5 projected hours

Three clinicians pass the hard eligibility filters in the supplied data. The interactive story displays the two with the most prior scheduled shifts in the affected unit. This is a transparent presentation choice, not a claim that the third person is ineligible.

## Data-quality evidence

- Exact duplicate contract rows: 664
- Exact duplicate leave rows: 44,538
- Roster work codes requiring whitespace trimming: 455,016
- Invalid or out-of-range position date values detected: 4,819
- Invalid leave date values detected: 3

The preparation script counts and quarantines invalid dates instead of coercing them. Exact duplicates do not contribute twice to matching or calculations.

## Decision-date limitation

The only annual-leave balance snapshot found for `SYN001597` is effective 1 October 2026. Because the demonstration decision date is 18 September 2026, the engine returns the balance as unavailable. It displays the future snapshot only as provenance and does not use it to assert entitlement.

## Matching fields

The candidate engine uses active contract dates, occupational group, position name, rate ID, roster overlap, booked-leave overlap, pay-period hours and prior unit experience. Age and gender remain visible only in the source column inventory and never enter normalized candidate records or matching logic. Free-text leave reasons are also excluded.

## Policy boundary

The supplied Useful Links document names Awards and Agreements, Policy Frameworks, an Artificial Intelligence Policy, a Nurse Midwife to Patient Ratios Policy and a Management of Accrued Leave Policy. It does not contain the policy rule text. Staffing ratios, fatigue, credentials and award checks therefore remain unknown and require manager review.
