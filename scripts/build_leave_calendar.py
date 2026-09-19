"""Extract only the requester's September roster for the leave calendar."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Users\Anurag\AppData\Local\Temp\Hackathon Synthetic Rosters (1).csv")

def minutes(value):
    hours, minute = map(int, value.strip().split(":"))
    return hours * 60 + minute

shifts = []
with SOURCE.open(encoding="utf-8-sig", newline="") as stream:
    for row in csv.DictReader(stream):
        if row["Employee ID"] != "SYN001597" or not row["Shift Date"].startswith("2026-09-"):
            continue
        start = minutes(row["Shift Start Time"])
        end = minutes(row["Shift End Time"])
        if end <= start:
            end += 1440
        meal = minutes(row["Meal Break Duration"])
        shifts.append({"date": row["Shift Date"], "start": row["Shift Start Time"], "end": row["Shift End Time"], "mealMinutes": meal, "netHours": round((end - start - meal) / 60, 2), "unit": row["Roster Unit"], "unitDescription": row["Roster Unit and Description"], "workCode": row["Work Code"].strip()})

payload = {"employeeId": "SYN001597", "sourceFile": SOURCE.name, "loadedFrom": "2026-09-01", "loadedThrough": "2026-09-30", "shifts": sorted(shifts, key=lambda shift: (shift["date"], shift["start"], shift["unit"]))}
(ROOT / "src/data/leave-calendar.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
print(f"Extracted {len(shifts)} September roster rows for {payload['employeeId']}.")
