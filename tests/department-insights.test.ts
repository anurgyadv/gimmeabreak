import {describe,it,expect} from 'vitest';
import {calendarImported,getDepartmentInsights,getLeavePlan,monthBounds,summarizeHistory} from '../src/server/department-insights';
import {getEmployee} from '../src/server/workforce-db';
import type {Booking} from '../src/lib/workforce-types';

const source=(overrides:Partial<Parameters<typeof calendarImported>[0][number]>={})=>({sourceId:'source#row=2',employeeId:'A',code:'AL',type:'ANNUAL LEAVE',start:'2025-01-02',end:'2025-01-03',hours:16,status:'Historical',recordType:'Leave Taken',...overrides});

describe('manager department evidence',()=>{
 it('rejects invalid months and resolves leap years',()=>{
  expect(monthBounds('2024-02')).toEqual(['2024-02-01','2024-02-29']);
  for(const month of ['2026-13','2026-2','2026-00','2026-09-01','../data'])expect(()=>getDepartmentInsights(month)).toThrow();
 });
 it('clips a leave period covering the entire month without prorating hours',()=>{
  const rows=calendarImported([source({start:'2026-08-15',end:'2026-10-15',hours:240,status:'Future',recordType:'Booked Leave'})],'2026-09-01','2026-09-30');
  expect(rows).toHaveLength(1);expect(rows[0].start).toBe('2026-09-01');expect(rows[0].end).toBe('2026-09-30');expect(rows[0].hours).toBeNull();expect(rows[0].originalStart).toBe('2026-08-15');
 });
 it('does not mix bookings, overlaps or cross-year spans into precise history totals',()=>{
  const rows=[source(),source({sourceId:'source#row=3',recordType:'Booked Leave',status:'Future'}),source({sourceId:'source#row=4',start:'2025-12-30',end:'2026-01-03',hours:40}),source({sourceId:'source#row=5',start:'2025-04-01',end:'2025-04-03',hours:24}),source({sourceId:'source#row=6',start:'2025-04-02',end:'2025-04-04',hours:24})];
  const history=summarizeHistory(rows,2025,'2026-09-19');
  expect(history).toHaveLength(1);expect(history[0].hours).toBe(16);expect(history[0].records).toBe(1);expect(history[0].omittedRecords).toBe(3);
  expect(summarizeHistory([source({status:'Future',recordType:'Booked Leave'})],2025,'2026-09-19')).toEqual([]);
 });
 it('keeps personal leave descriptive and preserves distinct code/type balances',()=>{
  const insights=getDepartmentInsights('2026-09');
  const employee=insights.employees.find(person=>person.id==='SYN008078')!;
  expect(employee.name).toBe('Sarah Chen');expect(employee.balances.find(balance=>balance.type==='ANNUAL LEAVE')?.remainingHours).toBe(129.091);
  expect(employee.excess).toBe(true);
  for(const person of insights.employees){expect(new Set(person.balances.map(balance=>balance.code+'|'+balance.type)).size).toBe(person.balances.length);expect(person.leave.every(leave=>leave.start>='2026-09-01'&&leave.end<='2026-09-30')).toBe(true);}
  expect(insights.limitations.join(' ')).toContain('never a negative fairness factor');
 });
 it('rejects a real employee outside inferred department membership',()=>{
  const members=new Set(getDepartmentInsights('2026-09').employees.map(employee=>employee.id));
  const outside=['SYN009320','SYN003869','SYN006074','SYN000001','SYN000002'].find(id=>getEmployee(id)&&!members.has(id));
  expect(outside).toBeDefined();expect(()=>getLeavePlan(outside!)).toThrow('not a current member');
 });
 it('uses actual excess long-service balance for bounded inferred low-impact windows',()=>{
  const plan=getLeavePlan('SYN008078');
  expect(plan.eligible).toBe(true);expect(plan.leaveCode).toBe('LS');expect(plan.balanceHours).toBeCloseTo(592.042694);expect(plan.policyUrl).toContain('Management-of-Accrued-Leave');expect(plan.suggestions.length).toBeGreaterThan(0);expect(plan.suggestions.length).toBeLessThanOrEqual(3);
  for(const suggestion of plan.suggestions){expect(suggestion.dates.every(day=>day>='2026-09-21'&&day<='2026-10-04')).toBe(true);expect(suggestion.hours).toBeGreaterThan(0);expect(suggestion.staffingAfter).toBe(suggestion.staffingBefore-1);expect(suggestion.staffingBasis).toContain('not simultaneous coverage or policy minima');expect(suggestion.reason).toContain('Manager must verify');}
  expect(plan.limitations.join(' ')).toContain('never guaranteed safe staffing');
 });
 it('pending requests exclude overlapping windows and reserve available hours',()=>{
  const initial=getLeavePlan('SYN008078'),suggestion=initial.suggestions[0];
  const booking={id:'pending',employeeId:'SYN008078',leaveCode:'LS',leaveType:'LONG SERVICE LEAVE',dates:suggestion.dates,status:'manager-review',swap:null,assessment:{hours:590,shifts:[]}} as unknown as Booking;
  const held=getLeavePlan('SYN008078',[booking]);
  expect(held.suggestions).toHaveLength(0);expect(held.limitations.join(' ')).toContain('590 hours are reserved');
  const overlapping=getLeavePlan('SYN008078',[{...booking,assessment:{...booking.assessment,hours:8}}]);
  expect(overlapping.suggestions.every(window=>window.dates.every(day=>!suggestion.dates.includes(day)))).toBe(true);
  expect(getLeavePlan('SYN008078',[{...booking,status:'declined'}]).suggestions.length).toBeGreaterThan(0);
 });
 it('does not suggest leave over a pending colleague coverage commitment',()=>{
  const initial=getLeavePlan('SYN008078'),day=initial.suggestions[0].dates[0];
  const booking={id:'cover-reservation',employeeId:'OTHER',leaveCode:'AL',dates:[day],status:'awaiting-colleague',swap:{employeeId:'SYN008078',outgoing:{date:day},returnShift:null},assessment:{hours:8,shifts:[]}} as unknown as Booking;
  expect(getLeavePlan('SYN008078',[booking]).suggestions.every(suggestion=>!suggestion.dates.includes(day))).toBe(true);
 });
});
