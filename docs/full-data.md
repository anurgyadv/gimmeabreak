# Full workforce database

The server database processes every row of the four CSV files inside `C:/Users/Anurag/Downloads/OneDrive_2026-09-18.zip`. It is separate from the small browser evidence extract. The original archive is read directly and is not changed or unpacked into the application.

| Source | Original rows | Retained | Exact duplicates | Invalid rows omitted |
|---|---:|---:|---:|---:|
| Contracts | 10,596 | 9,932 | 664 | 0 |
| Leave balances | 37,551 | 37,551 | 0 | 0 |
| Leave records | 346,216 | 301,675 | 44,538 | 3 |
| Rosters | 551,018 | 550,937 | 0 | 81 |
| **Total** | **945,381** | **900,095** | **45,202** | **84** |

`data/workforce-manifest.json` records file names, original archive members, input field names, hashes, counts and invalid-row reasons. Contract rows with unresolved dates remain in the database rather than becoming valid open-ended contracts. Gender, age and personal leave-reason values are not stored; their original column names can still appear in schema provenance.

## Storage and server loading

- SQLite tables: `contracts`, `balances`, `rosters`, `leave_records`, `sources`, `metadata`.
- Source row numbers are one-based CSV row numbers, including the header. Exact duplicates retain their earliest row. Shift IDs use `fileName#row=N`, consistent with the browser extract.
- Indexes cover employee/date, department/date, role/rate, and overlapping leave lookups.
- Uncompressed database: **143,613,952 bytes**. Reproducible gzip: **19,006,397 bytes**. Gzip timestamps and embedded file names are omitted.
- The shipped file is `data/workforce.sqlite.gz`, outside `public/`. Never import it or the server module into client components.
- `src/server/workforce-db.ts` uses Node 22 `node:sqlite` with `DatabaseSync({readOnly:true})` and `PRAGMA query_only=ON`.
- On first access the loader verifies SHA-256 hashes, decompresses to an atomically installed, content-addressed file in `os.tmpdir()`, and caches a process singleton. Later startup verifies an existing cache file before use. Temporary file permissions are owner-only where the OS supports them.
- Deployment must include both `data/workforce.sqlite.gz` and `data/workforce-manifest.json` in the server filesystem. This module does not add public routes or browser downloads. Next standalone packaging must explicitly trace these assets in its server configuration.

## API

All functions are synchronous server helpers. Query values use bound SQLite parameters. Application routes remain responsible for authorisation and appropriate response scope; these helpers do not expose an HTTP endpoint.

| Function | Result |
|---|---|
| `getDatabaseStats()` | Manifest plus distinct contract employee count |
| `getEmployee(employeeId, asOf = '2026-09-19')` | Latest nonexpired applicable-start contract, or `null`; adds `contractStatus` and `sourceId` |
| `getBalances(employeeId, asOf)` | Latest balance per employee/code/**type**, effective on or before the requested date |
| `getRoster(employeeId, start, end)` | Employee roster records whose shift date falls inside the inclusive range |
| `getLeave(employeeId, start, end)` | Leave records intersecting the inclusive range; original status/type retained, with `sourceId` |
| `getDepartmentRoster(unit, start, end)` | All retained department assignments in the inclusive shift-date range |

Date inputs must be actual `YYYY-MM-DD` dates. Range queries reject reversed periods and spans above 366 days. Overnight checks should request adjacent dates because roster lookup filters recorded shift start dates. No inferred policy compliance is returned.

## Interpretation rules

Only a literally blank contract end is open-ended. A nonblank `NULL` or malformed end is returned as its original string and `contractStatus: 'unresolved'`; it must not establish eligibility. Contract starts that cannot be interpreted remain stored, but do not meet an as-of query. Missing contract hours remain `null`, never zero. No expired-contract fallback is applied.

Balance grouping uses code **and type** because `AL` also labels leave loading and other entitlements. Future snapshots are never substituted for current balances. Missing optional balance values remain `null`.

`00:60` is a valid 60-minute duration in the source meal-break field. Clock values are validated separately. Net hours account for overnight shifts and recorded meal durations. Unknown work codes remain unchanged apart from whitespace trimming; their meanings are not invented.

Industrial instrument labels are explicitly role-based inferences, not verified coverage. Leave status is preserved rather than reinterpreted as approval or cancellation. Roster assignments do not establish attendance, patient ratios or safe staffing.

## Rebuild and verification

Run `scripts/build_workforce_database.py` with Python 3 using its standard library. The helper creates its uncompressed working database in an OS temporary directory, performs SQLite integrity checking, then ships only compressed SQLite and the manifest. It reads shared parsing functions from `scripts/build_workforce_data.py`.

Run `npx vitest run tests/workforce-db.test.ts` using Node 22 with `node:sqlite`. Tests reconcile source totals, verify actual requester contract/balances and 72 rostered hours, match all 1,015 department fortnight assignments, exclude future balances, preserve unresolved contract ends and exercise parameterized queries/date validation.
