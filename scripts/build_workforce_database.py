"""Build the server-only, all-source workforce SQLite database using stdlib."""
from __future__ import annotations
import csv
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import sqlite3
import tempfile
import zipfile
from build_workforce_data import ARCHIVE, ROOT, parsed, numeric, minutes, duration_minutes, instrument

SCHEMA = '''
PRAGMA journal_mode=OFF;
PRAGMA synchronous=OFF;
CREATE TABLE sources(kind TEXT PRIMARY KEY,fileName TEXT NOT NULL,archiveMember TEXT NOT NULL,rawRows INTEGER NOT NULL,retainedRows INTEGER NOT NULL,duplicates INTEGER NOT NULL,invalidRows INTEGER NOT NULL,columnsJson TEXT NOT NULL);
CREATE TABLE contracts(sourceRow INTEGER PRIMARY KEY,employeeId TEXT NOT NULL,role TEXT NOT NULL,rate TEXT NOT NULL,occupationalGroup TEXT NOT NULL,unit TEXT NOT NULL,unitName TEXT NOT NULL,contractHours REAL,occupancy TEXT NOT NULL,contractStart TEXT,contractEnd TEXT,rawContractEnd TEXT NOT NULL,contractStatus TEXT NOT NULL,industrialInstrument TEXT NOT NULL,instrumentBasis TEXT NOT NULL);
CREATE TABLE balances(sourceRow INTEGER PRIMARY KEY,employeeId TEXT NOT NULL,code TEXT NOT NULL,type TEXT NOT NULL,effectiveDate TEXT NOT NULL,remainingHours REAL NOT NULL,untakenHours REAL,bookedHours REAL,excess INTEGER NOT NULL);
CREATE TABLE rosters(sourceRow INTEGER PRIMARY KEY,employeeId TEXT NOT NULL,unit TEXT NOT NULL,unitName TEXT NOT NULL,date TEXT NOT NULL,start TEXT NOT NULL,end TEXT NOT NULL,mealMinutes INTEGER NOT NULL,netHours REAL NOT NULL,payPeriodStart TEXT NOT NULL,payPeriodEnd TEXT NOT NULL,workCode TEXT NOT NULL);
CREATE TABLE leave_records(sourceRow INTEGER PRIMARY KEY,employeeId TEXT NOT NULL,type TEXT NOT NULL,code TEXT NOT NULL,start TEXT NOT NULL,end TEXT NOT NULL,hours REAL NOT NULL,status TEXT NOT NULL,recordType TEXT NOT NULL);
CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
'''
INDEXES = '''
CREATE INDEX contracts_employee_date ON contracts(employeeId,contractStart DESC);
CREATE INDEX contracts_role_rate ON contracts(role,rate,unit);
CREATE INDEX balances_employee_date ON balances(employeeId,effectiveDate DESC,code,type);
CREATE INDEX rosters_employee_date ON rosters(employeeId,date);
CREATE INDEX rosters_unit_date ON rosters(unit,date);
CREATE INDEX leaves_employee_dates ON leave_records(employeeId,start,end);
'''


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def build():
    data_dir = ROOT / 'data'
    data_dir.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='gimme-workforce-build-') as temporary:
        database = Path(temporary) / 'workforce.sqlite'
        connection = sqlite3.connect(database)
        connection.executescript(SCHEMA)
        sources, quality = [], {'invalidContractEnds': 0, 'invalidContractStarts': 0, 'invalidContractHours': 0, 'normalizedMealDurations': 0, 'invalidRowsByReason': {}}
        with zipfile.ZipFile(ARCHIVE) as archive:
            for kind, token, table in [('contracts','Contracts/','contracts'),('balances','Balances/','balances'),('leave','Taken/','leave_records'),('rosters','Rosters/','rosters')]:
                member = next(name for name in archive.namelist() if name.endswith('.csv') and token in name)
                seen = set()
                raw_count = duplicates = invalid_count = retained = 0
                batch = []
                with io.TextIOWrapper(archive.open(member), encoding='utf-8-sig', newline='') as stream:
                    reader = csv.DictReader(stream)
                    columns = reader.fieldnames
                    for row_number, row in enumerate(reader, 2):
                        raw_count += 1
                        digest = hashlib.blake2b(json.dumps(row, ensure_ascii=False, separators=(',', ':')).encode(), digest_size=20).digest()
                        if digest in seen:
                            duplicates += 1
                            continue
                        seen.add(digest)
                        try:
                            employee = row['Employee ID'].strip()
                            if not employee:
                                raise ValueError('missing_employee')
                            if kind == 'contracts':
                                start, end = parsed(row['Position Entry Start Date']), parsed(row['Position Entry End Date'])
                                raw_end = row['Position Entry End Date'].strip()
                                hours = numeric(row['Total Position Entry Contract Hours'])
                                if start is None: quality['invalidContractStarts'] += 1
                                if raw_end and end is None: quality['invalidContractEnds'] += 1
                                if hours is None: quality['invalidContractHours'] += 1
                                role, group = row['Position Name'].strip(), row['Occupational Group'].strip()
                                agreement, basis = instrument(role, group)
                                status = 'verified' if start and (end or not raw_end) and hours is not None else 'unresolved'
                                values = (row_number, employee, role, row['Position Rate ID'].strip(), group, row['Roster Unit'].strip(), row['Roster Unit Description'].strip(), hours, row['Occupancy Status'].strip(), start.isoformat() if start else None, end.isoformat() if end else None, raw_end, status, agreement, basis)
                            elif kind == 'balances':
                                effective, remaining = parsed(row['Date Effective']), numeric(row['Total Leave Remaining Hours'])
                                if not effective: raise ValueError('invalid_effective_date')
                                if remaining is None: raise ValueError('invalid_balance_hours')
                                values = (row_number,employee,row['Leave Code'].strip(),row['Leave Type Group Name'].strip(),effective.isoformat(),remaining,numeric(row['Total Leave Untaken Hours']),numeric(row['Booked Leave Hours']),int(row['Has Excess Leave'].strip().lower() in ('yes','true','1')))
                            elif kind == 'leave':
                                start,end,hours = parsed(row['Leave Start Date']),parsed(row['Leave End Date']),numeric(row['Leave Hours'])
                                if not start or not end or end < start: raise ValueError('invalid_leave_dates')
                                if hours is None: raise ValueError('invalid_leave_hours')
                                values = (row_number,employee,row['Leave Type Name'].strip(),row['Leave Type Code'].strip(),start.isoformat(),end.isoformat(),hours,row['Leave Status Name'].strip(),row['Leave Record Type'].strip())
                            else:
                                day, pp_start, pp_end = (parsed(row[key]) for key in ('Shift Date','Pay Period Start Date','Pay Period End Date'))
                                if not day or not pp_start or not pp_end or pp_end < pp_start: raise ValueError('invalid_roster_dates')
                                try:
                                    start,end = minutes(row['Shift Start Time']),minutes(row['Shift End Time'])
                                    meal = duration_minutes(row['Meal Break Duration'])
                                except (ValueError,TypeError): raise ValueError('invalid_roster_time')
                                duration = end-start if end>start else end+1440-start
                                if meal>duration: raise ValueError('meal_exceeds_shift')
                                if int(row['Meal Break Duration'].split(':')[1])>=60: quality['normalizedMealDurations'] += 1
                                values = (row_number,employee,row['Roster Unit'].strip(),row['Roster Unit and Description'].strip(),day.isoformat(),row['Shift Start Time'].strip(),row['Shift End Time'].strip(),meal,round((duration-meal)/60,4),pp_start.isoformat(),pp_end.isoformat(),row['Work Code'].strip())
                        except ValueError as error:
                            invalid_count += 1
                            reason = f'{kind}:{error}'
                            quality['invalidRowsByReason'][reason] = quality['invalidRowsByReason'].get(reason,0)+1
                            continue
                        batch.append(values)
                        retained += 1
                        if len(batch)>=5000:
                            connection.executemany(f"INSERT INTO {table} VALUES ({','.join('?' for _ in values)})",batch)
                            batch.clear()
                    if batch:
                        connection.executemany(f"INSERT INTO {table} VALUES ({','.join('?' for _ in batch[0])})",batch)
                source = {'kind':kind,'fileName':Path(member).name,'archiveMember':member,'rows':raw_count,'retainedRows':retained,'exactDuplicatesRemoved':duplicates,'invalidRows':invalid_count,'columns':columns}
                sources.append(source)
                connection.execute('INSERT INTO sources VALUES (?,?,?,?,?,?,?,?)',(kind,source['fileName'],member,raw_count,retained,duplicates,invalid_count,json.dumps(columns)))
                connection.commit()
                print(f'{kind}: {raw_count:,} source rows; {retained:,} retained; {duplicates:,} duplicates; {invalid_count:,} invalid.',flush=True)
        metadata = {'schemaVersion':1,'archiveName':ARCHIVE.name,'archiveSha256':sha(ARCHIVE),'sourceRows':sum(s['rows'] for s in sources),'retainedRows':sum(s['retainedRows'] for s in sources),'sources':sources,'quality':quality,'excludedFields':['Gender','Age','Leave Reason Name'],'dateSemantics':'Only blank contract ends are open-ended. Nonblank NULL or invalid dates remain unresolved. Balances are keyed by employee + code + type. Meal duration 00:60 means 60 minutes.'}
        connection.execute('INSERT INTO metadata VALUES (?,?)',('manifest',json.dumps(metadata,separators=(',',':'))))
        connection.executescript(INDEXES)
        connection.execute('ANALYZE')
        assert connection.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
        connection.commit()
        connection.execute('VACUUM')
        connection.close()
        compressed = data_dir / 'workforce.sqlite.gz'
        with database.open('rb') as source, compressed.open('wb') as target:
            with gzip.GzipFile(filename='',mode='wb',compresslevel=9,fileobj=target,mtime=0) as zipped:
                shutil.copyfileobj(source,zipped)
        metadata.update({'databaseSha256':sha(database),'compressedSha256':sha(compressed),'databaseBytes':database.stat().st_size,'compressedBytes':compressed.stat().st_size})
        (data_dir / 'workforce-manifest.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({key:metadata[key] for key in ('sourceRows','retainedRows','databaseBytes','compressedBytes','databaseSha256')},indent=2))

if __name__=='__main__': build()
