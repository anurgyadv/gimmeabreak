# Workforce source profile

Archive: `C:\Users\Anurag\Downloads\OneDrive_2026-09-18.zip`

Period: **2026-09-21–2026-10-04**; decision date: **2026-09-19**; conflict/rest buffer: **2026-09-14–2026-10-11**.

Selected source employee: **SYN008078**, Registered Nurse, rate **NEA011**, department **SU0325**.

## Source rows

| Source | Raw rows | Exact duplicates removed |
|---|---:|---:|
| Hackathon Synthetic Employee Details-Contracts.csv | 10,596 | 664 |
| Hackathon Synthetic Leave Balances.csv | 37,551 | 0 |
| Hackathon Synthetic Rosters.csv | 551,018 | 0 |
| Hackathon Synthetic Leave Taken.csv | 346,216 | 44,538 |

Total: **945,381 rows**. Extract: **232 employees, 2760 shifts, 145 leave records, 950 balance records**. JSON: **1,453,379 bytes**.

## Selected employee balances

| Type | Code | Effective | Remaining hours |
|---|---|---|---:|
| SICK/PERSONAL LEAVE CUMULATIVE | PE | 2026-09-17 | 243.76 |
| ANNUAL LEAVE | AL | 2026-09-17 | 129.091 |
| LONG SERVICE LEAVE | LS | 2026-09-17 | 592.042694 |

## Selection and interpretation

- Selection is deterministic: among Registered Nurses with a contract covering the full period, all three annual/personal/long-service as-of balances, >=4 department shifts and roster hours within contract capacity, maximise same-rate department connections, then nursing department connections, then target shift count; break ties by source employee ID and unit.
- All 180 people rostered in SU0325 during the fortnight are included, plus 2 department-buffer-only staff and 50 additional Registered Nurse same-rate candidates. Every included employee shift across all units is retained for 2026-09-14 through 2026-10-11. Department shifts in the one-day buffer are also retained.
- Source headcounts are roster assignments, not verified staffing requirements. Patient demand, ratios, credentials and ward suitability remain unresolved. Role/rate matches are not confirmed safe cover.
- Contract end dates are open only when literally blank. Nonblank NULL, invalid dates, and expired contracts do not establish full-period eligibility; unresolved department contracts retain their actual source values and are identified in quality.
- Balances are grouped by employee + code + type, because AL also labels leave-loading and other leave types. Select the latest record effective on/before decisionDate; if absent retain the earliest future-only record with its actual date. Never use future-only balance as current entitlement.
- Work codes are retained after whitespace trimming. Their meanings are unknown and no work-code or appointment-status exclusion has been invented.
- Meal Break Duration is elapsed time, not a clock: source 00:60 is retained as 60 minutes. Rows with malformed clock values or meals exceeding shift duration are omitted and counted; skipped rows affecting the selected scope are explicitly listed in quality.
- All exact duplicate records are removed before calculations. Stable shift IDs identify the archive CSV basename and original one-based row number including the header; duplicates retain the first occurrence.
- Leave rows retain recorded status and record type. Overlap is evidence requiring interpretation; imported historical or future status is not transformed into a new request or an approval.
- Employee IDs are source identifiers. No names, protected attributes, prices, staffing ratios or demand counts have been manufactured.
- industrialInstrument is a role-based routing inference, not verified industrial coverage: nursing roles containing nurse other than Enrolled Nurse map to ANF_2024; Enrolled Nurse and Assistant in Nursing map to UWU_2024; MEDICAL group maps to AMA_2024; others UNKNOWN. instrumentBasis states this uncertainty for every employee.
- Historical staffing context covers SU0325 over 2026-07-27–2026-09-20 (56 days). weekday uses JavaScript convention 0=Sunday through 6=Saturday. Bands use recorded shift start: night before 06:00 or at/after 20:00; evening 12:00–19:59; day 06:00–11:59. Exact recorded roles are kept separate. Each date/role/band counts distinct employee IDs. Every weekday sample includes all eight dates, including zero counts. min/median/max are descriptive roster history, never policy minimums, safe staffing requirements, or proof of actual attendance.
- Historical role attribution prefers the latest contract whose valid dates cover the shift. Where validity is unresolved, use the latest recorded role starting on/before that date only as a descriptive classification, not as eligibility evidence; such assignment rows are counted in quality.historicalRoleDateUnresolvedRows. Missing prior contract roles are UNKNOWN.

## Quality details

```json
{
  "exactDuplicateRowsRemoved": {
    "contracts": 664,
    "balances": 0,
    "leave": 44538,
    "rosters": 0
  },
  "invalidFieldsOrRows": {
    "contractEndNonblank": 4648,
    "rosterTimeWithinBuffer": 8,
    "leaveDate": 2
  },
  "normalizedMealDurationRecordsInBuffer": 1291,
  "skippedRosterRowsInSelectedScope": [],
  "balanceEffectiveDateCounts": {
    "2026-08-20": 4058,
    "2026-08-27": 4185,
    "2026-09-03": 4529,
    "2026-09-10": 4305,
    "2026-09-17": 4410,
    "2026-09-24": 4018,
    "2026-10-01": 3822,
    "2026-10-08": 4026,
    "2026-10-15": 4198
  },
  "unresolvedContractEmployeeIds": [
    "SYN000186",
    "SYN000219",
    "SYN000258",
    "SYN000290",
    "SYN000378",
    "SYN001740",
    "SYN001765",
    "SYN001793",
    "SYN001843",
    "SYN001859",
    "SYN002202",
    "SYN002257",
    "SYN002272",
    "SYN002368",
    "SYN002403",
    "SYN002592",
    "SYN002648",
    "SYN003080",
    "SYN003139",
    "SYN003284",
    "SYN003313",
    "SYN003348",
    "SYN003480",
    "SYN003621",
    "SYN003626",
    "SYN003736",
    "SYN003845",
    "SYN003887",
    "SYN004017",
    "SYN004043",
    "SYN004099",
    "SYN004189",
    "SYN004210",
    "SYN004266",
    "SYN004284",
    "SYN004307",
    "SYN004346",
    "SYN004466",
    "SYN004565",
    "SYN004636",
    "SYN004651",
    "SYN004680",
    "SYN004861",
    "SYN005055",
    "SYN005066",
    "SYN005203",
    "SYN005279",
    "SYN005283",
    "SYN005322",
    "SYN005395",
    "SYN005541",
    "SYN005686",
    "SYN005780",
    "SYN005877",
    "SYN005927",
    "SYN006280",
    "SYN006396",
    "SYN006416",
    "SYN006670",
    "SYN006851",
    "SYN006951",
    "SYN007058",
    "SYN007060",
    "SYN007082",
    "SYN007098",
    "SYN007193",
    "SYN007206",
    "SYN007228",
    "SYN007354",
    "SYN007397",
    "SYN007421",
    "SYN007533",
    "SYN007535",
    "SYN007565",
    "SYN007915",
    "SYN007928",
    "SYN007966",
    "SYN007973",
    "SYN008133",
    "SYN008152",
    "SYN008237",
    "SYN008259",
    "SYN008318",
    "SYN008338",
    "SYN008409",
    "SYN008693",
    "SYN008778",
    "SYN009400",
    "SYN009456"
  ],
  "missingContractEmployeeIds": [],
  "futureOnlyBalanceRecords": 489,
  "fullArchiveRows": 945381,
  "selectedDepartmentEmployeeCount": 180,
  "compatibleCandidateCount": 75,
  "fullSameRoleRatePoolCount": 805,
  "additionalCandidateLimit": 50,
  "historicalRoleDateUnresolvedRows": 3102,
  "historicalUniqueRosterPersonBandDays": 5288
}
```

Rebuild with `scripts/build_workforce_data.py` using Python standard library. The original archive is read without extraction or modification.
