"""Stream the supplied archive into a reproducible, connected workforce extract.

No roster-code meanings, missing balances, or employee identities are invented.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path
from statistics import median
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = Path(r"C:\Users\Anurag\Downloads\OneDrive_2026-09-18.zip")
START, END, DECISION = date(2026, 9, 21), date(2026, 10, 4), date(2026, 9, 19)
BUFFER_START, BUFFER_END = START - timedelta(days=7), END + timedelta(days=7)
CONNECT_START, CONNECT_END = START - timedelta(days=1), END + timedelta(days=1)
HISTORY_START, HISTORY_END = START - timedelta(days=56), START - timedelta(days=1)
MAX_ADDITIONAL_CANDIDATES = 50


def parsed(value: str) -> date | None:
    try:
        result = date.fromisoformat(value.strip()[:10])
        return result if 1900 <= result.year <= 2100 else None
    except (ValueError, TypeError):
        return None


def numeric(value: str) -> float | None:
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def minutes(value: str) -> int:
    hour, minute = map(int, value.strip().split(":"))
    if not 0 <= hour <= 23 or not 0 <= minute <= 59:
        raise ValueError(value)
    return hour * 60 + minute


def duration_minutes(value: str) -> int:
    # Duration fields can contain 00:60; unlike a time of day, this is 60 minutes.
    hour, minute = map(int, value.strip().split(':'))
    if hour < 0 or minute < 0:
        raise ValueError(value)
    return hour * 60 + minute


def instrument(role: str, group: str) -> tuple[str, str]:
    lowered = role.lower()
    if 'enrolled nurse' in lowered or 'assistant in nursing' in lowered:
        return 'UWU_2024', f'Inferred from recorded role {role}; industrial coverage is not verified.'
    if 'nurse' in lowered and group == 'NURSING':
        return 'ANF_2024', f'Inferred from recorded nursing role {role}; industrial coverage is not verified.'
    if group == 'MEDICAL':
        return 'AMA_2024', f'Inferred from recorded medical role {role}; industrial coverage is not verified.'
    return 'UNKNOWN', f'No supported instrument inference for recorded role {role}; industrial coverage is not verified.'


def build() -> None:
    sources, duplicates, invalid = [], Counter(), Counter()
    contracts = defaultdict(list)
    balances = []
    shift_rows = []
    leaves = []
    balance_dates = Counter()
    skipped_roster_rows = []
    normalized_meals = 0
    historical_people = defaultdict(set)
    historical_roles = set()
    historical_unresolved_role_rows = 0
    with zipfile.ZipFile(ARCHIVE) as archive:
        members = {kind: next(name for name in archive.namelist() if name.endswith('.csv') and token in name) for kind, token in [('contracts', 'Contracts/'), ('balances', 'Balances/'), ('leave', 'Taken/'), ('rosters', 'Rosters/')]}

        def rows(kind):
            seen = set()
            with io.TextIOWrapper(archive.open(members[kind]), encoding='utf-8-sig', newline='') as stream:
                reader = csv.DictReader(stream)
                profile = {'kind': kind, 'fileName': Path(members[kind]).name, 'rows': 0, 'columns': reader.fieldnames}
                sources.append(profile)
                for row_number, row in enumerate(reader, 2):
                    profile['rows'] += 1
                    digest = hashlib.blake2b(json.dumps(row, ensure_ascii=False, separators=(',', ':')).encode(), digest_size=20).digest()
                    if digest in seen:
                        duplicates[kind] += 1
                        continue
                    seen.add(digest)
                    yield row_number, row

        for number, row in rows('contracts'):
            start, end = parsed(row['Position Entry Start Date']), parsed(row['Position Entry End Date'])
            if start is None:
                invalid['contractStart'] += 1
            if row['Position Entry End Date'].strip() and end is None:
                invalid['contractEndNonblank'] += 1
            record = {'id': row['Employee ID'], 'role': row['Position Name'].strip(), 'rate': row['Position Rate ID'].strip(), 'group': row['Occupational Group'].strip(), 'unit': row['Roster Unit'].strip(), 'unitName': row['Roster Unit Description'].strip(), 'contractHours': numeric(row['Total Position Entry Contract Hours']), 'occupancy': row['Occupancy Status'].strip(), 'contractStart': start.isoformat() if start else row['Position Entry Start Date'], 'contractEnd': end.isoformat() if end else row['Position Entry End Date'].strip()}
            record['industrialInstrument'], record['instrumentBasis'] = instrument(record['role'], record['group'])
            contracts[record['id']].append((record, start, end, number))

        for _, row in rows('balances'):
            effective = parsed(row['Date Effective'])
            if not effective:
                invalid['balanceDate'] += 1
                continue
            remaining = numeric(row['Total Leave Remaining Hours'])
            if remaining is None:
                invalid['balanceHours'] += 1
                continue
            balance_dates[effective.isoformat()] += 1
            balances.append({'employeeId': row['Employee ID'], 'code': row['Leave Code'].strip(), 'type': row['Leave Type Group Name'].strip(), 'effectiveDate': effective.isoformat(), 'remainingHours': remaining, 'untakenHours': numeric(row['Total Leave Untaken Hours']), 'bookedHours': numeric(row['Booked Leave Hours']), 'excess': row['Has Excess Leave'].strip().lower() in ('yes', 'true', '1')})

        for number, row in rows('rosters'):
            shift_date, pp_start, pp_end = (parsed(row[field]) for field in ('Shift Date', 'Pay Period Start Date', 'Pay Period End Date'))
            if not shift_date or not pp_start or not pp_end:
                invalid['rosterDate'] += 1
                continue
            if row['Roster Unit'].strip() == 'SU0325' and HISTORY_START <= shift_date <= HISTORY_END:
                try:
                    shift_start = minutes(row['Shift Start Time'])
                except (ValueError, TypeError):
                    invalid['historicalShiftStart'] += 1
                else:
                    band = 'night' if shift_start < 360 or shift_start >= 1200 else 'evening' if shift_start >= 720 else 'day'
                    historical_entries = [entry for entry in contracts[row['Employee ID']] if entry[1] and entry[1] <= shift_date]
                    valid_entries = [entry for entry in historical_entries if entry[2] and entry[2] >= shift_date or not entry[0]['contractEnd']]
                    if valid_entries:
                        historical_role = max(valid_entries, key=lambda entry: (entry[1], -entry[3]))[0]['role']
                    elif historical_entries:
                        historical_role = max(historical_entries, key=lambda entry: (entry[1], -entry[3]))[0]['role']
                        historical_unresolved_role_rows += 1
                    else:
                        historical_role = 'UNKNOWN'
                        historical_unresolved_role_rows += 1
                    historical_roles.add(historical_role)
                    historical_people[(shift_date.isoformat(), band, historical_role)].add(row['Employee ID'])
            if not BUFFER_START <= shift_date <= BUFFER_END:
                continue
            try:
                start, end = (minutes(row[field]) for field in ('Shift Start Time', 'Shift End Time'))
                meal = duration_minutes(row['Meal Break Duration'])
                if int(row['Meal Break Duration'].split(':')[1]) >= 60:
                    normalized_meals += 1
                duration = (end - start) if end > start else (end + 1440 - start)
                if meal > duration:
                    raise ValueError('Meal exceeds shift')
            except (ValueError, TypeError):
                invalid['rosterTimeWithinBuffer'] += 1
                skipped_roster_rows.append({'sourceRow': number, 'employeeId': row['Employee ID'], 'unit': row['Roster Unit'], 'date': row['Shift Date'], 'start': row['Shift Start Time'], 'end': row['Shift End Time'], 'meal': row['Meal Break Duration']})
                continue
            shift_rows.append({'id': f"{Path(members['rosters']).name}#row={number}", 'employeeId': row['Employee ID'], 'unit': row['Roster Unit'].strip(), 'unitName': row['Roster Unit and Description'].strip(), 'date': shift_date.isoformat(), 'start': row['Shift Start Time'].strip(), 'end': row['Shift End Time'].strip(), 'mealMinutes': meal, 'netHours': round((duration - meal) / 60, 4), 'payPeriodStart': pp_start.isoformat(), 'payPeriodEnd': pp_end.isoformat(), 'workCode': row['Work Code'].strip()})

        for _, row in rows('leave'):
            start, end = parsed(row['Leave Start Date']), parsed(row['Leave End Date'])
            if not start or not end:
                invalid['leaveDate'] += 1
                continue
            if start > BUFFER_END or end < BUFFER_START:
                continue
            hours = numeric(row['Leave Hours'])
            if hours is None:
                invalid['leaveHoursWithinBuffer'] += 1
                continue
            leaves.append({'employeeId': row['Employee ID'], 'type': row['Leave Type Name'].strip(), 'code': row['Leave Type Code'].strip(), 'start': start.isoformat(), 'end': end.isoformat(), 'hours': hours, 'status': row['Leave Status Name'].strip(), 'recordType': row['Leave Record Type'].strip()})

    def covers_period(entry):
        record, start, end, _ = entry
        return start is not None and start <= START and (end is not None and end >= END or not record['contractEnd']) and record['contractHours'] is not None

    active = {}
    for employee, entries in contracts.items():
        eligible = [entry for entry in entries if covers_period(entry)]
        if eligible:
            active[employee] = max(eligible, key=lambda entry: (entry[1], -entry[3]))[0]
    rns = {employee: record for employee, record in active.items() if record['role'] == 'Registered Nurse' and record['group'] == 'NURSING'}
    latest_balances = {}
    for balance in balances:
        balance_key = (balance['employeeId'], balance['code'], balance['type'])
        if balance['effectiveDate'] <= DECISION.isoformat():
            previous = latest_balances.get(balance_key)
            if previous is None or balance['effectiveDate'] > previous['effectiveDate']:
                latest_balances[balance_key] = balance
    balance_types = defaultdict(set)
    for balance in latest_balances.values():
        balance_types[balance['employeeId']].add(balance['type'])
    required_types = {'ANNUAL LEAVE', 'SICK/PERSONAL LEAVE CUMULATIVE', 'LONG SERVICE LEAVE'}
    shifts_by_employee, unit_people, unit_rns = defaultdict(list), defaultdict(set), defaultdict(set)
    for shift in shift_rows:
        shifts_by_employee[shift['employeeId']].append(shift)
        if START.isoformat() <= shift['date'] <= END.isoformat():
            unit_people[shift['unit']].add(shift['employeeId'])
            if shift['employeeId'] in rns:
                unit_rns[shift['unit']].add(shift['employeeId'])
    choices = []
    for unit, people in unit_rns.items():
        for employee in sorted(people):
            record = rns[employee]
            if not required_types <= balance_types[employee]:
                continue
            owned = [shift for shift in shifts_by_employee[employee] if shift['unit'] == unit and START.isoformat() <= shift['date'] <= END.isoformat()]
            compatible = {person for person in people if rns[person]['rate'] == record['rate']}
            hours = sum(shift['netHours'] for shift in shifts_by_employee[employee] if START.isoformat() <= shift['date'] <= END.isoformat())
            if len(owned) < 4 or hours > record['contractHours'] or record['contractHours'] <= 0:
                continue
            score = (len(compatible), len(people), len(owned), -abs(record['contractHours'] - hours))
            choices.append((score, employee, unit, compatible))
    if not choices:
        raise RuntimeError('No RN with verified period contract, three valid balances and meaningful roster found')
    _, target, unit, connected = sorted(choices, key=lambda choice: (tuple(-n for n in choice[0]), choice[1], choice[2]))[0]
    rate = rns[target]['rate']
    pool = {employee for employee, record in rns.items() if record['rate'] == rate and any(CONNECT_START.isoformat() <= shift['date'] <= CONNECT_END.isoformat() for shift in shifts_by_employee[employee])}
    extra = sorted(pool - unit_people[unit], key=lambda employee: (-sum(shift['unit'] == unit and CONNECT_START.isoformat() <= shift['date'] <= CONNECT_END.isoformat() for shift in shifts_by_employee[employee]), employee))[:MAX_ADDITIONAL_CANDIDATES]
    department_buffer_people = {shift['employeeId'] for shift in shift_rows if shift['unit'] == unit and CONNECT_START.isoformat() <= shift['date'] <= CONNECT_END.isoformat()}
    included = unit_people[unit] | department_buffer_people | set(extra) | {target}
    employees = []
    unresolved_contract_ids = []
    for employee in sorted(included):
        if employee in active:
            employees.append(active[employee])
        elif employee in contracts:
            # Retain actual unresolved department contract evidence; never invent eligibility.
            dated = [entry for entry in contracts[employee] if entry[1] and entry[1] <= END]
            selected = max(dated or contracts[employee], key=lambda entry: (entry[1] or date.min, -entry[3]))[0]
            employees.append(selected)
            unresolved_contract_ids.append(employee)
    chosen_balances = [balance for balance in latest_balances.values() if balance['employeeId'] in included]
    # Preserve a future-only balance when no as-of record exists for that exact code/type.
    future_only = {}
    for balance in balances:
        balance_key = (balance['employeeId'], balance['code'], balance['type'])
        if balance['employeeId'] not in included or balance_key in latest_balances or balance['effectiveDate'] <= DECISION.isoformat():
            continue
        previous = future_only.get(balance_key)
        if previous is None or balance['effectiveDate'] < previous['effectiveDate']:
            future_only[balance_key] = balance
    chosen_balances += list(future_only.values())
    selected_shifts = [shift for shift in shift_rows if shift['employeeId'] in included]
    selected_leave = [leave for leave in leaves if leave['employeeId'] in included]
    historical_staffing = []
    historical_dates = [HISTORY_START + timedelta(days=index) for index in range(56)]
    for weekday in range(7):
        dates = [day for day in historical_dates if (day.weekday() + 1) % 7 == weekday]
        for band in ('day', 'evening', 'night'):
            for role in sorted(historical_roles):
                daily_counts = [{'date': day.isoformat(), 'count': len(historical_people[(day.isoformat(), band, role)])} for day in dates]
                values = [item['count'] for item in daily_counts]
                historical_staffing.append({'unit': 'SU0325', 'weekday': weekday, 'band': band, 'role': role, 'min': min(values), 'median': median(values), 'max': max(values), 'sampleDays': len(values), 'start': HISTORY_START.isoformat(), 'end': HISTORY_END.isoformat(), 'dailyCounts': daily_counts})
    quality = {'exactDuplicateRowsRemoved': {kind: duplicates[kind] for kind in ('contracts', 'balances', 'leave', 'rosters')}, 'invalidFieldsOrRows': dict(invalid), 'normalizedMealDurationRecordsInBuffer': normalized_meals, 'skippedRosterRowsInSelectedScope': [row for row in skipped_roster_rows if row['employeeId'] in included or row['unit'] == unit], 'balanceEffectiveDateCounts': dict(sorted(balance_dates.items())), 'unresolvedContractEmployeeIds': unresolved_contract_ids, 'missingContractEmployeeIds': sorted(included - set(contracts)), 'futureOnlyBalanceRecords': len(future_only), 'fullArchiveRows': sum(source['rows'] for source in sources), 'selectedDepartmentEmployeeCount': len(unit_people[unit]), 'compatibleCandidateCount': len((pool & included) - {target}), 'fullSameRoleRatePoolCount': len(pool - {target}), 'additionalCandidateLimit': MAX_ADDITIONAL_CANDIDATES}
    quality['historicalRoleDateUnresolvedRows'] = historical_unresolved_role_rows
    quality['historicalUniqueRosterPersonBandDays'] = sum(len(people) for people in historical_people.values())
    notes = [
        'Selection is deterministic: among Registered Nurses with a contract covering the full period, all three annual/personal/long-service as-of balances, >=4 department shifts and roster hours within contract capacity, maximise same-rate department connections, then nursing department connections, then target shift count; break ties by source employee ID and unit.',
        f'All {len(unit_people[unit])} people rostered in {unit} during the fortnight are included, plus {len(department_buffer_people - unit_people[unit])} department-buffer-only staff and {len(extra)} additional Registered Nurse same-rate candidates. Every included employee shift across all units is retained for {BUFFER_START} through {BUFFER_END}. Department shifts in the one-day buffer are also retained.',
        'Source headcounts are roster assignments, not verified staffing requirements. Patient demand, ratios, credentials and ward suitability remain unresolved. Role/rate matches are not confirmed safe cover.',
        'Contract end dates are open only when literally blank. Nonblank NULL, invalid dates, and expired contracts do not establish full-period eligibility; unresolved department contracts retain their actual source values and are identified in quality.',
        'Balances are grouped by employee + code + type, because AL also labels leave-loading and other leave types. Select the latest record effective on/before decisionDate; if absent retain the earliest future-only record with its actual date. Never use future-only balance as current entitlement.',
        'Work codes are retained after whitespace trimming. Their meanings are unknown and no work-code or appointment-status exclusion has been invented.',
        'Meal Break Duration is elapsed time, not a clock: source 00:60 is retained as 60 minutes. Rows with malformed clock values or meals exceeding shift duration are omitted and counted; skipped rows affecting the selected scope are explicitly listed in quality.',
        'All exact duplicate records are removed before calculations. Stable shift IDs identify the archive CSV basename and original one-based row number including the header; duplicates retain the first occurrence.',
        'Leave rows retain recorded status and record type. Overlap is evidence requiring interpretation; imported historical or future status is not transformed into a new request or an approval.',
        'Employee IDs are source identifiers. No names, protected attributes, prices, staffing ratios or demand counts have been manufactured.',
        'industrialInstrument is a role-based routing inference, not verified industrial coverage: nursing roles containing nurse other than Enrolled Nurse map to ANF_2024; Enrolled Nurse and Assistant in Nursing map to UWU_2024; MEDICAL group maps to AMA_2024; others UNKNOWN. instrumentBasis states this uncertainty for every employee.',
        f'Historical staffing context covers SU0325 over {HISTORY_START}–{HISTORY_END} (56 days). weekday uses JavaScript convention 0=Sunday through 6=Saturday. Bands use recorded shift start: night before 06:00 or at/after 20:00; evening 12:00–19:59; day 06:00–11:59. Exact recorded roles are kept separate. Each date/role/band counts distinct employee IDs. Every weekday sample includes all eight dates, including zero counts. min/median/max are descriptive roster history, never policy minimums, safe staffing requirements, or proof of actual attendance.',
        'Historical role attribution prefers the latest contract whose valid dates cover the shift. Where validity is unresolved, use the latest recorded role starting on/before that date only as a descriptive classification, not as eligibility evidence; such assignment rows are counted in quality.historicalRoleDateUnresolvedRows. Missing prior contract roles are UNKNOWN.',
    ]
    result = {'period': {'start': START.isoformat(), 'end': END.isoformat(), 'decisionDate': DECISION.isoformat()}, 'employeeId': target, 'unit': unit, 'employees': employees, 'balances': sorted(chosen_balances, key=lambda item: (item['employeeId'], item['code'], item['type'])), 'shifts': sorted(selected_shifts, key=lambda item: (item['date'], item['employeeId'], item['start'], item['id'])), 'leave': sorted(selected_leave, key=lambda item: (item['start'], item['employeeId'], item['code'])), 'historicalStaffing': historical_staffing, 'sources': sources, 'quality': quality, 'notes': notes}
    output = ROOT / 'src/data/workforce.json'
    output.write_text(json.dumps(result, separators=(',', ':'), ensure_ascii=False) + '\n', encoding='utf-8')
    target_balances = [balance for balance in chosen_balances if balance['employeeId'] == target]
    document = ['# Workforce source profile', '', f'Archive: `{ARCHIVE}`', '', f'Period: **{START}–{END}**; decision date: **{DECISION}**; conflict/rest buffer: **{BUFFER_START}–{BUFFER_END}**.', '', f'Selected source employee: **{target}**, Registered Nurse, rate **{rate}**, department **{unit}**.', '', '## Source rows', '', '| Source | Raw rows | Exact duplicates removed |', '|---|---:|---:|']
    document += [f"| {source['fileName']} | {source['rows']:,} | {duplicates[source['kind']]:,} |" for source in sources]
    document += ['', f"Total: **{quality['fullArchiveRows']:,} rows**. Extract: **{len(employees)} employees, {len(selected_shifts)} shifts, {len(selected_leave)} leave records, {len(chosen_balances)} balance records**. JSON: **{output.stat().st_size:,} bytes**.", '', '## Selected employee balances', '', '| Type | Code | Effective | Remaining hours |', '|---|---|---|---:|']
    document += [f"| {balance['type']} | {balance['code']} | {balance['effectiveDate']} | {balance['remainingHours']} |" for balance in target_balances]
    document += ['', '## Selection and interpretation', ''] + [f'- {note}' for note in notes]
    document += ['', '## Quality details', '', '```json', json.dumps(quality, indent=2), '```', '', 'Rebuild with `scripts/build_workforce_data.py` using Python standard library. The original archive is read without extraction or modification.', '']
    (ROOT / 'docs/workforce-data-profile.md').write_text('\n'.join(document), encoding='utf-8')
    assert len({shift['id'] for shift in selected_shifts}) == len(selected_shifts)
    assert all(BUFFER_START.isoformat() <= shift['date'] <= BUFFER_END.isoformat() for shift in selected_shifts)
    assert required_types <= {balance['type'] for balance in target_balances if balance['effectiveDate'] <= DECISION.isoformat()}
    assert rns[target]['contractHours'] > 0
    assert all(item['sampleDays'] == 8 and len(item['dailyCounts']) == 8 and item['min'] <= item['median'] <= item['max'] for item in historical_staffing)
    print(json.dumps({'employeeId': target, 'unit': unit, 'rate': rate, 'employees': len(employees), 'shifts': len(selected_shifts), 'leave': len(selected_leave), 'balances': target_balances, 'quality': quality, 'bytes': output.stat().st_size}, indent=2))


if __name__ == '__main__':
    build()
