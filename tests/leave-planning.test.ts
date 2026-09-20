import {describe,it,expect} from 'vitest';
import {planningBalance,flaggedBalance} from '../src/lib/leave-planning';
import {getDepartmentInsights,getLeavePlan} from '../src/server/department-insights';
import type {Balance} from '../src/lib/workforce-types';
const balance=(patch:Partial<Balance>)=>({employeeId:'SYN1',code:'AL',type:'ANNUAL LEAVE',remainingHours:400,excess:true,effectiveDate:'2026-09-17',untakenHours:400,bookedHours:0,...patch} as Balance);
describe('leave planning shortlist',()=>{
 it('excludes personal leave, loading, zero and unflagged balances',()=>{
  for(const b of [balance({code:'PE',type:'PERSONAL LEAVE',remainingHours:900}),balance({type:'LEAVE LOADING'}),balance({remainingHours:0}),balance({remainingHours:-2}),balance({excess:false})])expect(planningBalance(b)).toBe(false);
 });
 it('shows the actual flagged balance even when another leave type is low',()=>{
  const annual=balance({remainingHours:12,excess:false}),long=balance({code:'LS',type:'LONG SERVICE LEAVE',remainingHours:592});
  expect(flaggedBalance([annual,long])?.code).toBe('LS');
 });
 it('keeps department shortlist and plan eligibility aligned',()=>{
  const people=getDepartmentInsights('2026-09').employees;
  for(const person of people)expect(person.excess).toBe(person.balances.some(planningBalance));
  expect(getLeavePlan('SYN008078').leaveCode).toBe('LS');
  const priority=people.filter(e=>e.excess).sort((a,b)=>flaggedBalance(b.balances)!.remainingHours-flaggedBalance(a.balances)!.remainingHours).slice(0,5);
  expect(priority.some(e=>e.id==='SYN008078')).toBe(true);
 });
});


