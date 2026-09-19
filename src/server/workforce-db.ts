import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';
import type { Balance, Employee, LeaveRecord, Shift } from '../lib/workforce-types';

type Source = {kind:string;fileName:string;archiveMember:string;rows:number;retainedRows:number;exactDuplicatesRemoved:number;invalidRows:number;columns:string[]};
type Manifest = {schemaVersion:number;archiveName:string;archiveSha256:string;sourceRows:number;retainedRows:number;sources:Source[];quality:Record<string,unknown>;excludedFields:string[];dateSemantics:string;databaseSha256:string;compressedSha256:string;databaseBytes:number;compressedBytes:number};
export type EmployeeEvidence = Omit<Employee,'contractHours'> & {contractHours:number|null;contractStatus:'verified'|'unresolved';sourceId:string};
type Cache = {db:DatabaseSync;manifest:Manifest};
const globalCache = globalThis as typeof globalThis & { __gimmeWorkforceDatabase?: Cache };
const digest = (bytes:Buffer) => createHash('sha256').update(bytes).digest('hex');

function database():Cache {
  if (typeof window !== 'undefined') throw new Error('Workforce database is available on the server only.');
  if (globalCache.__gimmeWorkforceDatabase) return globalCache.__gimmeWorkforceDatabase;
  const directory = resolve(process.cwd(),'data');
  const manifest = JSON.parse(readFileSync(join(directory,'workforce-manifest.json'),'utf8')) as Manifest;
  if (manifest.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(manifest.databaseSha256)) throw new Error('Unsupported workforce database manifest.');
  const destination = join(tmpdir(),`gimme-workforce-${manifest.databaseSha256}.sqlite`);
  if (!existsSync(destination) || digest(readFileSync(destination)) !== manifest.databaseSha256) {
    const compressed = readFileSync(join(directory,'workforce.sqlite.gz'));
    if (digest(compressed) !== manifest.compressedSha256) throw new Error('Workforce archive integrity check failed.');
    const bytes = gunzipSync(compressed);
    if (digest(bytes) !== manifest.databaseSha256) throw new Error('Workforce database integrity check failed.');
    const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(temporary,bytes,{flag:'wx',mode:0o600});
    try { renameSync(temporary,destination); }
    catch (error) {
      if (!existsSync(destination) || digest(readFileSync(destination)) !== manifest.databaseSha256) throw error;
    } finally { if (existsSync(temporary)) unlinkSync(temporary); }
  }
  const db = new DatabaseSync(destination,{readOnly:true});
  db.exec('PRAGMA query_only=ON;');
  globalCache.__gimmeWorkforceDatabase = {db,manifest};
  return globalCache.__gimmeWorkforceDatabase;
}

function validDate(value:string):void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date must use YYYY-MM-DD.');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==value) throw new Error('Date is invalid.');
}
function validRange(start:string,end:string):void {
  validDate(start);validDate(end);
  if (start>end) throw new Error('Range end must be on or after its start.');
  if (Date.parse(end)-Date.parse(start)>366*86400000) throw new Error('Requested range cannot exceed 366 days.');
}
const sourceFile = (kind:string) => database().manifest.sources.find(source=>source.kind===kind)!.fileName;

export function getDatabaseStats():Manifest & {employeeCount:number} {
  const {db,manifest} = database();
  const row = db.prepare('SELECT count(DISTINCT employeeId) AS total FROM contracts').get() as {total:number};
  return {...manifest,employeeCount:row.total};
}

/** No expired contract fallback. Nonblank unknown end dates remain explicitly unresolved. */
export function getEmployee(employeeId:string,asOf='2026-09-19'):EmployeeEvidence|null {
  validDate(asOf);
  const row = database().db.prepare(`SELECT employeeId AS id,role,rate,occupationalGroup AS "group",unit,unitName,contractHours,occupancy,contractStart,
    CASE WHEN rawContractEnd='' THEN NULL WHEN contractEnd IS NOT NULL THEN contractEnd ELSE rawContractEnd END AS contractEnd,
    industrialInstrument,instrumentBasis,contractStatus,sourceRow FROM contracts
    WHERE employeeId=? AND contractStart<=? AND (contractEnd>=? OR contractEnd IS NULL)
    ORDER BY contractStart DESC,CASE contractStatus WHEN 'verified' THEN 0 ELSE 1 END,sourceRow ASC LIMIT 1`).get(employeeId,asOf,asOf) as (Omit<EmployeeEvidence,'sourceId'> & {sourceRow:number})|undefined;
  if (!row) return null;
  const {sourceRow,...employee} = row;
  return {...employee,sourceId:`${sourceFile('contracts')}#row=${sourceRow}`};
}

/** Leave code alone is not a unique type: AL includes annual leave and leave loading. */
export function getBalances(employeeId:string,asOf:string):Balance[] {
  validDate(asOf);
  const rows = database().db.prepare(`SELECT employeeId,code,type,effectiveDate,remainingHours,untakenHours,bookedHours,excess FROM (
    SELECT *,ROW_NUMBER() OVER(PARTITION BY employeeId,code,type ORDER BY effectiveDate DESC,sourceRow ASC) AS rank
    FROM balances WHERE employeeId=? AND effectiveDate<=?
  ) WHERE rank=1 ORDER BY code,type`).all(employeeId,asOf) as unknown as (Omit<Balance,'excess'> & {excess:number})[];
  return rows.map(row=>({...row,excess:row.excess===1}));
}

function rosterQuery(field:'employeeId'|'unit',value:string,start:string,end:string):Shift[] {
  validRange(start,end);
  const rows = database().db.prepare(`SELECT sourceRow,employeeId,unit,unitName,date,start,end,mealMinutes,netHours,payPeriodStart,payPeriodEnd,workCode FROM rosters WHERE ${field}=? AND date>=? AND date<=? ORDER BY date,start,employeeId,sourceRow`).all(value,start,end) as unknown as (Omit<Shift,'id'> & {sourceRow:number})[];
  const file = sourceFile('rosters');
  return rows.map(({sourceRow,...shift})=>({...shift,id:`${file}#row=${sourceRow}`}));
}
export function getRoster(employeeId:string,start:string,end:string):Shift[] {return rosterQuery('employeeId',employeeId,start,end);}
export function getDepartmentRoster(unit:string,start:string,end:string):Shift[] {return rosterQuery('unit',unit,start,end);}

export function getLeave(employeeId:string,start:string,end:string):(LeaveRecord & {sourceId:string})[] {
  validRange(start,end);
  const rows = database().db.prepare('SELECT sourceRow,employeeId,type,code,start,end,hours,status,recordType FROM leave_records WHERE employeeId=? AND start<=? AND end>=? ORDER BY start,end,sourceRow').all(employeeId,end,start) as unknown as (LeaveRecord & {sourceRow:number})[];
  const file = sourceFile('leave');
  return rows.map(({sourceRow,...leave})=>({...leave,sourceId:`${file}#row=${sourceRow}`}));
}
