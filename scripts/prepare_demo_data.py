"""Build the small CoverAssist demo dataset from the supplied synthetic CSVs.

The script streams the source files, applies the real matching rules used by
the demo, and writes only the golden-path evidence required at runtime.
"""

from __future__ import annotations

import csv
import hashlib
import json
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = Path(r"C:\Users\Anurag\AppData\Local\Temp")
SOURCES = {
    "contracts": SOURCE_DIR / "Hackathon Synthetic Employee Details-Contracts (1).csv",
    "balances": SOURCE_DIR / "Hackathon Synthetic Leave Balances (1).csv",
    "leave": SOURCE_DIR / "Hackathon Synthetic Leave Taken (1).csv",
    "rosters": SOURCE_DIR / "Hackathon Synthetic Rosters (1).csv",
}
OUTPUT = ROOT / "src" / "data" / "coverassist-demo.json"
SCHEMA_OUTPUT = ROOT / "src" / "data" / "coverassist-demo.schema.json"

DECISION_DATE = date(2026, 9, 18)
SHIFT_DATE = date(2026, 9, 21)
PAY_PERIOD_START = date(2026, 9, 21)
PAY_PERIOD_END = date(2026, 10, 4)
REQUESTER = "SYN001597"
TARGET_UNIT = "SU0325"
TARGET_ROLE = "Resident Medical Officer"
TARGET_RATE = "DBRM01"


def parse_date(value: str) -> date | None:
    text = value.strip()[:10]
    try:
        parsed = datetime.strptime(text, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None
    return parsed if 1900 <= parsed.year <= 2100 else None


def parse_time(value: str) -> time:
    return datetime.strptime(value.strip(), "%H:%M").time()


def minutes(value: str) -> int:
    parsed = parse_time(value)
    return parsed.hour * 60 + parsed.minute


def net_shift_hours(start: str, end: str, meal: str) -> float:
    start_minutes = minutes(start)
    end_minutes = minutes(end)
    if end_minutes <= start_minutes:
        end_minutes += 24 * 60
    return round((end_minutes - start_minutes - minutes(meal)) / 60, 2)


def overlaps(start_a: time, end_a: time, start_b: time, end_b: time) -> bool:
    a1, a2 = start_a.hour * 60 + start_a.minute, end_a.hour * 60 + end_a.minute
    b1, b2 = start_b.hour * 60 + start_b.minute, end_b.hour * 60 + end_b.minute
    if a2 <= a1:
        a2 += 1440
    if b2 <= b1:
        b2 += 1440
    return a1 < b2 and b1 < a2


def fingerprint(row: dict[str, str], columns: list[str]) -> bytes:
    joined = "\x1f".join(row.get(column, "") for column in columns)
    return hashlib.blake2b(joined.encode("utf-8"), digest_size=12).digest()


def rows(path: Path) -> Iterable[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        yield from csv.DictReader(handle)


def profile_sources() -> tuple[list[dict[str, Any]], dict[str, int]]:
    profiles: list[dict[str, Any]] = []
    duplicate_counts: dict[str, int] = {}
    for kind, path in SOURCES.items():
        seen: set[bytes] = set()
        duplicates = 0
        count = 0
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            columns = list(reader.fieldnames or [])
            for row in reader:
                count += 1
                marker = fingerprint(row, columns)
                if marker in seen:
                    duplicates += 1
                else:
                    seen.add(marker)
        profiles.append({"kind": kind, "fileName": path.name, "rowCount": count, "columns": columns})
        duplicate_counts[kind] = duplicates
    return profiles, duplicate_counts


def active_on(row: dict[str, str], target: date) -> bool:
    start = parse_date(row["Position Entry Start Date"])
    end = parse_date(row["Position Entry End Date"])
    return bool(start and start <= target and (end is None or end >= target))


def prepare() -> dict[str, Any]:
    profiles, duplicate_counts = profile_sources()
    invalid_dates = defaultdict(int)
    trimmed_work_codes = 0

    requester_row: dict[str, str] | None = None
    compatible: dict[str, dict[str, str]] = {}
    for row in rows(SOURCES["contracts"]):
        start = parse_date(row["Position Entry Start Date"])
        end = parse_date(row["Position Entry End Date"])
        if start is None:
            invalid_dates["contracts"] += 1
        if row["Position Entry End Date"].strip() and end is None:
            invalid_dates["contracts"] += 1
        if row["Employee ID"] == REQUESTER and active_on(row, SHIFT_DATE):
            requester_row = row
        if (
            row["Position Name"].strip() == TARGET_ROLE
            and row["Position Rate ID"].strip() == TARGET_RATE
            and row["Occupational Group"].strip() == "MEDICAL"
            and active_on(row, SHIFT_DATE)
        ):
            compatible.setdefault(row["Employee ID"], row)

    if requester_row is None:
        raise RuntimeError(f"Could not resolve active contract for {REQUESTER}")

    balance_rows: list[dict[str, str]] = []
    for row in rows(SOURCES["balances"]):
        effective = parse_date(row["Date Effective"])
        if effective is None:
            invalid_dates["balances"] += 1
        if row["Employee ID"] == REQUESTER and row["Leave Code"].strip() == "AL" and effective:
            balance_rows.append(row)
    prior_balances = [row for row in balance_rows if parse_date(row["Date Effective"]) <= DECISION_DATE]
    future_balances = [row for row in balance_rows if parse_date(row["Date Effective"]) > DECISION_DATE]
    valid_balance = max(prior_balances, key=lambda row: row["Date Effective"], default=None)
    future_balance = min(future_balances, key=lambda row: row["Date Effective"], default=None)

    leave_conflicts: set[str] = set()
    request_leave: dict[str, str] | None = None
    for row in rows(SOURCES["leave"]):
        start = parse_date(row["Leave Start Date"])
        end = parse_date(row["Leave End Date"])
        if start is None or end is None:
            invalid_dates["leave"] += 1
            continue
        employee_id = row["Employee ID"]
        if employee_id == REQUESTER and start <= SHIFT_DATE <= end and row["Leave Type Code"].strip() == "AL":
            request_leave = row
        if employee_id in compatible and start <= SHIFT_DATE <= end:
            leave_conflicts.add(employee_id)

    pay_period_hours: dict[str, float] = defaultdict(float)
    roster_conflicts: set[str] = set()
    unit_experience: dict[str, int] = defaultdict(int)
    last_worked: dict[str, date] = {}
    affected_shift: dict[str, str] | None = None
    target_start, target_end = time(7, 0), time(15, 30)

    for row in rows(SOURCES["rosters"]):
        shift_date = parse_date(row["Shift Date"])
        pp_start = parse_date(row["Pay Period Start Date"])
        pp_end = parse_date(row["Pay Period End Date"])
        if not shift_date or not pp_start or not pp_end:
            invalid_dates["rosters"] += 1
            continue
        work_code = row["Work Code"]
        if work_code != work_code.strip():
            trimmed_work_codes += 1
        employee_id = row["Employee ID"]
        if employee_id == REQUESTER and shift_date == SHIFT_DATE and row["Roster Unit"].strip() == TARGET_UNIT:
            affected_shift = row
        if employee_id not in compatible:
            continue
        if pp_start == PAY_PERIOD_START and pp_end == PAY_PERIOD_END:
            pay_period_hours[employee_id] += net_shift_hours(row["Shift Start Time"], row["Shift End Time"], row["Meal Break Duration"])
        if shift_date == SHIFT_DATE and overlaps(parse_time(row["Shift Start Time"]), parse_time(row["Shift End Time"]), target_start, target_end):
            roster_conflicts.add(employee_id)
        # Experience uses shifts scheduled before the affected shift. The
        # roster is forward-looking, so known assignments after the decision
        # date but before 21 September still count as unit experience.
        if row["Roster Unit"].strip() == TARGET_UNIT and shift_date < SHIFT_DATE:
            unit_experience[employee_id] += 1
            if employee_id not in last_worked or shift_date > last_worked[employee_id]:
                last_worked[employee_id] = shift_date

    if request_leave is None or affected_shift is None:
        raise RuntimeError("Golden leave record or affected shift is missing")

    shift_hours = net_shift_hours(affected_shift["Shift Start Time"], affected_shift["Shift End Time"], affected_shift["Meal Break Duration"])
    candidates: list[dict[str, Any]] = []
    for employee_id, row in compatible.items():
        if employee_id == REQUESTER:
            continue
        current_hours = round(pay_period_hours[employee_id], 2)
        projected = round(current_hours + shift_hours, 2)
        if employee_id in roster_conflicts or employee_id in leave_conflicts:
            continue
        if projected > float(row["Total Position Entry Contract Hours"]):
            continue
        if unit_experience[employee_id] <= 0:
            continue
        candidates.append({
            "employeeId": employee_id,
            "role": row["Position Name"].strip(),
            "rateId": row["Position Rate ID"].strip(),
            "contractHours": float(row["Total Position Entry Contract Hours"]),
            "currentPayPeriodHours": current_hours,
            "projectedPayPeriodHours": projected,
            "rosterConflict": False,
            "leaveConflict": False,
            "homeUnit": row["Roster Unit"].strip(),
            "priorUnitShiftCount": unit_experience[employee_id],
            "lastWorkedInUnit": last_worked.get(employee_id).isoformat() if last_worked.get(employee_id) else None,
            "sourceFields": {
                "Employee ID": employee_id,
                "Position Name": row["Position Name"],
                "Total Position Entry Contract Hours": row["Total Position Entry Contract Hours"],
                "Occupational Group": row["Occupational Group"],
                "Rate Grouping": row["Rate Grouping"],
                "Position Rate ID": row["Position Rate ID"],
                "Roster Unit": row["Roster Unit"],
            },
        })
    candidates.sort(key=lambda item: (-item["priorUnitShiftCount"], item["employeeId"]))
    eligible_pool_size = len(candidates)
    # Keep the scripted story focused on the two strongest unit-experience
    # examples. The full pool size remains visible so this is not presented as
    # an eligibility conclusion.
    candidates = candidates[:2]

    balance: dict[str, Any]
    if valid_balance:
        balance = {
            "status": "available",
            "effectiveDate": valid_balance["Date Effective"],
            "remainingHours": float(valid_balance["Total Leave Remaining Hours"]),
        }
    else:
        balance = {
            "status": "unavailable",
            "explanation": "No annual-leave balance snapshot is effective on or before the decision date.",
            "futureSnapshot": {
                "effectiveDate": future_balance["Date Effective"] if future_balance else None,
                "remainingHours": float(future_balance["Total Leave Remaining Hours"]) if future_balance else None,
            },
        }

    return {
        "provenance": {
            "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
            "decisionDate": DECISION_DATE.isoformat(),
            "dataVersion": "hackathon-synthetic-derived-v1",
            "sourceFiles": profiles,
            "quality": {
                "exactDuplicateCounts": duplicate_counts,
                "invalidDateCounts": dict(invalid_dates),
                "trimmedWorkCodeCount": trimmed_work_codes,
            },
        },
        "scenario": {
            "employee": {
                "employeeId": requester_row["Employee ID"],
                "role": requester_row["Position Name"].strip(),
                "rateId": requester_row["Position Rate ID"].strip(),
                "contractHours": float(requester_row["Total Position Entry Contract Hours"]),
                "homeUnit": requester_row["Roster Unit"].strip(),
                "occupationalGroup": requester_row["Occupational Group"].strip(),
                "sourceFields": {key: requester_row[key] for key in (
                    "Employee ID", "Position Name", "Position Entry Start Date", "Position Entry End Date",
                    "Total Position Entry Contract Hours", "Occupational Group", "Rate Grouping", "Position Rate ID",
                    "Roster Unit", "Roster Unit Description",
                )},
            },
            "request": {
                "leaveType": request_leave["Leave Type Name"].strip(),
                "startDate": parse_date(request_leave["Leave Start Date"]).isoformat(),
                "endDate": parse_date(request_leave["Leave End Date"]).isoformat(),
                "requestedHours": float(request_leave["Leave Hours"]),
                "sourceFields": {key: request_leave[key] for key in request_leave},
            },
            "balance": balance,
            "affectedShifts": [{
                "rosterUnit": affected_shift["Roster Unit"].strip(),
                "rosterUnitDescription": affected_shift["Roster Unit and Description"].strip(),
                "shiftDate": parse_date(affected_shift["Shift Date"]).isoformat(),
                "startTime": affected_shift["Shift Start Time"].strip(),
                "endTime": affected_shift["Shift End Time"].strip(),
                "mealBreakMinutes": minutes(affected_shift["Meal Break Duration"]),
                "netHours": shift_hours,
                "workCode": affected_shift["Work Code"].strip(),
                "payPeriodStart": parse_date(affected_shift["Pay Period Start Date"]).isoformat(),
                "payPeriodEnd": parse_date(affected_shift["Pay Period End Date"]).isoformat(),
                "sourceFields": {key: affected_shift[key] for key in affected_shift},
            }],
            "candidates": candidates,
            "eligibleCandidatePoolSize": eligible_pool_size,
            "candidateSelectionNote": "Showing the two eligible clinicians with the most prior scheduled shifts in SU0325.",
            "policyChecks": [
                {"id": "balance", "name": "Leave balance at decision date", "result": "unknown" if balance["status"] == "unavailable" else "pass", "explanation": balance.get("explanation", "A valid balance snapshot is available."), "requiresManagerReview": balance["status"] == "unavailable"},
                {"id": "staffing", "name": "Staffing ratio", "result": "unknown", "explanation": "The supplied links do not contain the rule text.", "requiresManagerReview": True},
                {"id": "fatigue", "name": "Fatigue and rest", "result": "unknown", "explanation": "No verified fatigue rule was supplied.", "requiresManagerReview": True},
                {"id": "credentials", "name": "Credentials and skill mix", "result": "unknown", "explanation": "The source data does not contain full credential evidence.", "requiresManagerReview": True},
            ],
            "toolTrace": [
                {"id": "employee", "label": "Employee context", "status": "complete"},
                {"id": "balance", "label": "Balance lookup", "status": balance["status"]},
                {"id": "shifts", "label": "Affected shifts", "status": "complete"},
                {"id": "coverage", "label": "Coverage impact", "status": "complete"},
                {"id": "candidates", "label": "Candidate filter", "status": "complete"},
                {"id": "policy", "label": "Policy rules", "status": "requires-review"},
            ],
        },
    }


SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "CoverAssist demo dataset",
    "type": "object",
    "required": ["provenance", "scenario"],
    "properties": {
        "provenance": {"type": "object", "required": ["decisionDate", "dataVersion", "sourceFiles", "quality"]},
        "scenario": {"type": "object", "required": ["employee", "request", "balance", "affectedShifts", "candidates", "policyChecks", "toolTrace"]},
    },
}


if __name__ == "__main__":
    for source in SOURCES.values():
        if not source.exists():
            raise SystemExit(f"Missing source file: {source}")
    result = prepare()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, indent=2), encoding="utf-8")
    SCHEMA_OUTPUT.write_text(json.dumps(SCHEMA, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")
    print(f"Candidates: {[item['employeeId'] for item in result['scenario']['candidates']]}")
    print(f"Source rows: {sum(item['rowCount'] for item in result['provenance']['sourceFiles']):,}")
