import {describe,it,expect} from 'vitest';
import {coverage,applyFloors,floorKey,roles} from '../src/lib/staffing-requirements';
import type {Workforce,Shift} from '../src/lib/workforce-types';
const shift=(id:string,employeeId:string,date:string,start:string,end:string)=>({id,employeeId,date,start,end,unit:'A',netHours:8,mealMinutes:0,unitName:'A',payPeriodStart:date,payPeriodEnd:date} as Shift);
const fixture=(shifts:Shift[])=>({unit:'A',employeeId:'one',employees:[{id:'one',role:roles[0]},{id:'two',role:roles[0]}],shifts,leave:[]} as Workforce);
describe('staffing requirements',()=>{
 it('does not count nonconcurrent people as simultaneous coverage',()=>{
  const w=fixture([shift('1','one','2026-09-21','07:00','11:00'),shift('2','two','2026-09-21','11:00','15:30')]);
  expect(coverage(w,'2026-09-21',0,roles[0])).toBe(1);
  expect(coverage(w,'2026-09-21',0,roles[0],'1')).toBe(0);
 });
 it('counts midnight-crossing duties and excludes recorded leave',()=>{
  const w=fixture([shift('1','one','2026-09-21','21:00','07:30')]);
  expect(coverage(w,'2026-09-21',2,roles[0])).toBe(1);
  w.leave=[{employeeId:'one',start:'2026-09-22',end:'2026-09-22',status:'Future'} as Workforce['leave'][number]];
  expect(coverage(w,'2026-09-21',2,roles[0])).toBe(0);
 });
 it('does not double count duplicate employee duties',()=>{
  expect(coverage(fixture([shift('1','one','2026-09-21','07:00','15:30'),shift('2','one','2026-09-21','07:00','15:30')]),'2026-09-21',0,roles[0])).toBe(1);
 });
 it('applies matching shift only and preserves unset versus zero',()=>{
  const f=applyFloors({},[0,null,...roles.slice(2).map(()=>2)],['2026-09-21','2026-09-22'],'2026-09-21',1,'matching');
  expect(Object.keys(f)).toHaveLength(20);
  expect(f[floorKey('2026-09-22',1,roles[0])]).toBe(0);
  expect(f[floorKey('2026-09-22',1,roles[1])]).toBeNull();
  expect(f[floorKey('2026-09-22',0,roles[0])]).toBeUndefined();
 });
 it('applies all ten floors across all day windows without mutating old values',()=>{
  const old={[floorKey('2026-09-23',0,roles[0])]:9};
  const f=applyFloors(old,roles.map(()=>3),['2026-09-21','2026-09-22'],'2026-09-21',1,'fortnight');
  expect(Object.keys(f)).toHaveLength(61);expect(Object.keys(old)).toHaveLength(1);
 });
});
