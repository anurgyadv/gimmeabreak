import {describe,expect,it} from 'vitest';
import {getBalances,getDatabaseStats,getDepartmentRoster,getEmployee,getLeave,getRoster} from '../src/server/workforce-db';

describe('all-source workforce database',()=>{
 it('accounts for every original source row without client-only subset limits',()=>{
  const stats=getDatabaseStats();
  expect(stats.sourceRows).toBe(945381);
  expect(stats.retainedRows).toBe(900095);
  expect(stats.sources.map(source=>[source.kind,source.rows,source.retainedRows])).toEqual([
   ['contracts',10596,9932],['balances',37551,37551],['leave',346216,301675],['rosters',551018,550937],
  ]);
  for(const source of stats.sources)expect(source.retainedRows+source.exactDuplicatesRemoved+source.invalidRows).toBe(source.rows);
  expect(stats.excludedFields).toEqual(['Gender','Age','Leave Reason Name']);
  expect(stats.employeeCount).toBeGreaterThan(7000);
 });
 it('returns the recorded RN contract and source provenance',()=>{
  const employee=getEmployee('SYN008078');
  expect(employee?.role).toBe('Registered Nurse');
  expect(employee?.contractHours).toBe(72);
  expect(employee?.contractStatus).toBe('verified');
  expect(employee?.sourceId).toMatch(/Contracts\.csv#row=\d+$/);
  expect(employee?.industrialInstrument).toBe('ANF_2024');
  expect(employee?.instrumentBasis).toContain('not verified');
 });
 it('retains unknown contract ends as unresolved and does not return expired contracts',()=>{
  const unresolved=getEmployee('SYN008693');
  expect(unresolved?.contractEnd).toBe('NULL');
  expect(unresolved?.contractStatus).toBe('unresolved');
  expect(getEmployee('SYN008078','2026-10-05')).toBeNull();
 });
 it('reproduces 72 fortnight hours and the complete department assignments',()=>{
  const shifts=getRoster('SYN008078','2026-09-21','2026-10-04');
  expect(shifts).toHaveLength(9);
  expect(shifts.reduce((sum,shift)=>sum+shift.netHours,0)).toBe(72);
  expect(new Set(shifts.map(shift=>shift.id)).size).toBe(9);
  expect(getDepartmentRoster('SU0325','2026-09-21','2026-10-04')).toHaveLength(1015);
 });
 it('selects genuine as-of balances and excludes future-only snapshots',()=>{
  const balances=getBalances('SYN008078','2026-09-19');
  expect(balances.find(balance=>balance.type==='ANNUAL LEAVE')?.remainingHours).toBe(129.091);
  expect(balances.every(balance=>balance.effectiveDate<='2026-09-19')).toBe(true);
  expect(getBalances('SYN008078','2026-09-16').some(balance=>balance.effectiveDate==='2026-09-17')).toBe(false);
  expect(getBalances('SYN001597','2026-09-19').find(balance=>balance.type==='ANNUAL LEAVE')).toBeUndefined();
  expect(getBalances('SYN001597','2026-10-01').find(balance=>balance.type==='ANNUAL LEAVE')?.remainingHours).toBeCloseTo(97.256465);
 });
 it('keeps distinct leave types sharing AL and returns original leave provenance',()=>{
  const balances=getBalances('SYN001597','2026-12-31');
  const keys=balances.map(balance=>`${balance.code}|${balance.type}`);
  expect(new Set(keys).size).toBe(keys.length);
  const leaves=getLeave('SYN001597','2026-09-21','2026-09-21');
  expect(leaves.some(leave=>leave.code==='AL'&&leave.hours===8)).toBe(true);
  expect(leaves.every(leave=>leave.sourceId.includes('#row='))).toBe(true);
 });
 it('parameterizes identifiers and validates dates before querying',()=>{
  expect(getEmployee("' OR 1=1 --")).toBeNull();
  expect(getRoster("' OR 1=1 --",'2026-09-21','2026-10-04')).toEqual([]);
  expect(()=>getBalances('SYN008078','2026-02-30')).toThrow();
  expect(()=>getRoster('SYN008078','2026-10-04','2026-09-21')).toThrow();
  expect(()=>getDepartmentRoster('SU0325','2020-01-01','2026-01-01')).toThrow();
 });
});
