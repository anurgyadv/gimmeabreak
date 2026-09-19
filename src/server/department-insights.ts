import raw from '../data/workforce.json';
import policies from '../data/policies.json';
import type {Booking,LeaveRecord,Shift} from '../lib/workforce-types';
import type {CalendarLeave,DepartmentEmployee,DepartmentInsights,LeaveHistory,LeavePlan,LeaveSuggestion} from '../lib/department-types';
import {getBalances,getDepartmentEmployees,getDepartmentRoster,getEmployee,getLeave,getRoster} from './workforce-db';

const AS_OF=raw.period.decisionDate,UNIT=raw.unit,START=raw.period.start,END=raw.period.end;
const YEAR=Number(AS_OF.slice(0,4));
const round=(n:number)=>Math.round(n*100)/100;
const activeBookings=(bookings:Booking[])=>bookings.filter(booking=>!['declined','changes-requested'].includes(booking.status));
const nextDay=(day:string)=>new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10);
const between=(day:string,start:string,end:string)=>day>=start&&day<=end;
const name=(id:string)=>{
 if(id===raw.employeeId)return 'Sarah Chen';
 const i=raw.employees.findIndex(employee=>employee.id===id);
 if(i<0)return `Staff ${id}`;
 return ['Emily','James','Priya','Daniel','Amelia','Oliver','Chloe','Ethan','Grace','Liam','Sophie','Noah','Aisha','Lucas','Isla','Mia'][i%16]+' '+['Zhang','Wilson','Kumar','Taylor','Nguyen','Patel','Williams','Brown','Martin','Lee','Thomas','Clarke','Harris','Wong','Walker'][Math.floor(i/16)%15];
};
const limitations=[
 'Department membership combines a current valid home-unit contract with roster assignments in the planning fortnight. It is inferred service membership, not a verified reporting hierarchy.',
 'Leave records and roster assignments do not establish actual attendance, complete leave history or safe staffing. Personal leave is descriptive evidence only and is never a negative fairness factor.',
 'Balance snapshots are effective on or before the as-of date. Missing balances are unknown; exact leave code and type remain separate.',
];

export function monthBounds(month:string):[string,string] {
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1900||Number(month.slice(0,4))>2100)throw new Error('Month must be a valid YYYY-MM between 1900 and 2100.');
 const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
 return [`${month}-01`,end];
}

type SourceLeave=LeaveRecord&{sourceId:string};
/** Return all intersecting spans, including a leave period which covers the whole month. */
export function calendarImported(records:SourceLeave[],start:string,end:string):CalendarLeave[] {
 return records.filter(record=>record.start<=end&&record.end>=start).map(record=>{
  const clipped=record.start<start||record.end>end;
  return {id:record.sourceId,employeeId:record.employeeId,start:record.start<start?start:record.start,end:record.end>end?end:record.end,originalStart:record.start,originalEnd:record.end,code:record.code,type:record.type,status:record.status,source:'imported',recordType:record.recordType,hours:clipped?null:record.hours,hoursBasis:clipped?'Date span clipped to the calendar month. Whole-record hours are not prorated.':'Recorded hours for the complete source period; not proof of attendance.'};
 });
}

export function summarizeHistory(records:SourceLeave[],year:number,asOf:string):LeaveHistory[] {
 const start=`${year}-01-01`,end=`${year}-12-31`;
 const applicable=records.filter(record=>record.recordType==='Leave Taken'&&record.status==='Historical'&&record.end<asOf&&record.start<=end&&record.end>=start);
 const grouped=new Map<string,SourceLeave[]>();
 for(const record of applicable){const key=record.code+'|'+record.type;grouped.set(key,[...(grouped.get(key)||[]),record]);}
 return [...grouped.values()].map(group=>{
  const kept=group.filter(record=>record.start>=start&&record.end<=end&&!group.some(other=>other.sourceId!==record.sourceId&&other.start<=record.end&&other.end>=record.start));
  const omitted=group.length-kept.length;
  return {year,code:group[0].code,type:group[0].type,hours:round(kept.reduce((sum,record)=>sum+record.hours,0)),records:kept.length,omittedRecords:omitted,basis:`Historical / Leave Taken records fully inside ${year} and ending before ${asOf}. ${omitted} overlapping or year-crossing records omitted; hours are not prorated. ${kept.length?'Recorded hours, not verified attendance.':'No safely summable records; this does not establish zero leave.'}`};
 }).sort((a,b)=>a.code.localeCompare(b.code)||a.type.localeCompare(b.type));
}

function calendarRequests(bookings:Booking[],employeeId:string,start:string,end:string):CalendarLeave[] {
 return activeBookings(bookings).filter(booking=>booking.employeeId===employeeId).flatMap(booking=>{
  const dates=[...new Set(booking.dates)].sort(),groups:string[][]=[];
  for(const date of dates){const last=groups[groups.length-1];if(last&&nextDay(last[last.length-1])===date)last.push(date);else groups.push([date]);}
  return groups.filter(group=>group[0]<=end&&group[group.length-1]>=start).map((group,index)=>{
   const originalStart=group[0],originalEnd=group[group.length-1],clipped=originalStart<start||originalEnd>end;
   const hours=booking.assessment.shifts.filter(shift=>group.includes(shift.date)&&!(booking.swap?.kind==='swap'&&booking.swap.outgoing.id===shift.id)).reduce((sum,shift)=>sum+shift.netHours,0);
   return {id:`request:${booking.id}:${index}`,employeeId,start:originalStart<start?start:originalStart,end:originalEnd>end?end:originalEnd,originalStart,originalEnd,code:booking.leaveCode,type:booking.leaveType,status:booking.status,source:'request' as const,recordType:'Workspace request',hours:clipped?null:round(hours),hoursBasis:clipped?'Request span clipped; hours not prorated.':'Requested paid leave based on affected shifts; equal-hour swapped shifts excluded. Not counted as historical leave.'};
  });
 });
}

export function getDepartmentInsights(month:string,bookings:Booking[]=[]):DepartmentInsights {
 const [start,end]=monthBounds(month);
 const employees:DepartmentEmployee[]=getDepartmentEmployees(UNIT,AS_OF,START,END).map(employee=>{
  const balances=getBalances(employee.id,AS_OF);
  const history=[YEAR-1,YEAR].flatMap(year=>summarizeHistory(getLeave(employee.id,`${year}-01-01`,`${year}-12-31`),year,AS_OF));
  const noPrevious=!history.some(item=>item.year===YEAR-1&&item.records>0);
  return {id:employee.id,name:name(employee.id),role:employee.role,rate:employee.rate,balances,leave:[...calendarImported(getLeave(employee.id,start,end),start,end),...calendarRequests(bookings,employee.id,start,end)].sort((a,b)=>a.start.localeCompare(b.start)),history,excess:balances.some(balance=>balance.excess),membershipBasis:employee.membershipBasis,contractStatus:employee.contractStatus,historyNote:`Only Historical / Leave Taken records enter annual history. Booked Leave / Future and Leave Taken / Future stay separate.${noPrevious?` No safely summable ${YEAR-1} records were found; this does not mean zero leave.`:''}`};
 });
 return {month,asOf:AS_OF,unit:UNIT,employees,limitations};
}

export function getLeavePlan(employeeId:string,bookings:Booking[]=[]):LeavePlan {
 const people=getDepartmentEmployees(UNIT,AS_OF,START,END);
 const employee=people.find(person=>person.id===employeeId);
 if(!employee)throw new Error('Employee is not a current member of this department.');
 const balance=getBalances(employeeId,AS_OF).filter(item=>item.excess&&((item.code==='AL'&&item.type==='ANNUAL LEAVE')||(item.code==='LS'&&item.type==='LONG SERVICE LEAVE'))).sort((a,b)=>a.code.localeCompare(b.code))[0];
 const policy=policies.documents.find(document=>document.id==='accrued-leave');
 const plan:LeavePlan={employeeId,name:name(employeeId),leaveCode:balance?.code||'',leaveType:balance?.type||'',balanceHours:balance?.remainingHours??0,bookedHours:balance?.bookedHours??null,balanceEffectiveDate:balance?.effectiveDate??null,eligible:!!balance&&employee.contractStatus==='verified',reason:balance?'The source balance carries an excess flag. An optional leave-planning conversation may help; the flag is not proof of a policy breach.':'No current annual or long-service balance has a recorded excess flag. No excess-leave invitation is suggested.',policyUrl:policy?.pdfUrl||policy?.url||'',suggestions:[],limitations:[...limitations,'Suggestions compare recorded same-role department assignments and known absences. They are inferred lower-impact options, never guaranteed safe staffing or an approval.','Source booked balance hours are shown separately and not deducted again from remaining hours. Pending workspace requests reserve additional hours.','Long-service leave portions and timing require agreement and applicable-policy verification. A proposed block is discussion material, not confirmation of entitlement to that portion.']};
 if(!balance)return plan;
 if(employee.contractStatus!=='verified'){plan.reason='The source excess flag needs review, but current contract eligibility is unresolved. No date suggestions are made.';return plan;}
 const active=activeBookings(bookings),myRequests=active.filter(booking=>booking.employeeId===employeeId);
 const reservedDutyDates=new Set(active.flatMap(booking=>{
  if(!booking.swap)return [];
  if(booking.swap.employeeId===employeeId)return [booking.swap.outgoing.date,...(booking.swap.returnShift?[booking.swap.returnShift.date]:[])];
  return booking.employeeId===employeeId&&booking.swap.returnShift?[booking.swap.returnShift.date]:[];
 }));
 const reserved=myRequests.filter(booking=>booking.leaveCode===balance.code).reduce((sum,booking)=>sum+Math.max(0,booking.assessment.hours-(booking.swap?.kind==='swap'?booking.swap.outgoing.netHours:0)),0);
 const available=balance.remainingHours-reserved;
 const mine=getRoster(employeeId,START,END),ownLeave=getLeave(employeeId,START,END);
 const roster=getDepartmentRoster(UNIT,START,END);
 const sameRole=new Set(people.filter(person=>person.role===employee.role).map(person=>person.id));
 const others=new Map(people.filter(person=>sameRole.has(person.id)&&person.id!==employeeId).map(person=>[person.id,getLeave(person.id,START,END)]));
 const absent=(id:string,day:string)=>[...(others.get(id)||[])].some(leave=>between(day,leave.start,leave.end))||active.some(booking=>booking.employeeId===id&&booking.dates.includes(day));
 const ownDates=[...new Set(mine.filter(shift=>shift.unit===UNIT).map(shift=>shift.date))].sort();
 const candidates:LeaveSuggestion[]=[];
 for(let index=0;index<ownDates.length;index++)for(const size of [1,2]){
  const dates=ownDates.slice(index,index+size);
  if(dates.length!==size||(size===2&&nextDay(dates[0])!==dates[1]))continue;
  if(dates.some(day=>reservedDutyDates.has(day)||ownLeave.some(leave=>between(day,leave.start,leave.end))||myRequests.some(booking=>booking.dates.includes(day))))continue;
  if(dates.some(day=>!getEmployee(employeeId,day)||getEmployee(employeeId,day)?.contractStatus!=='verified'))continue;
  const affected=mine.filter(shift=>dates.includes(shift.date));
  if(affected.some(shift=>shift.unit!==UNIT))continue;
  const hours=round(affected.reduce((sum,shift)=>sum+shift.netHours,0));
  if(hours<=0||hours>available)continue;
  const counts=dates.map(day=>new Set(roster.filter(shift=>shift.date===day&&sameRole.has(shift.employeeId)&&!absent(shift.employeeId,day)).map(shift=>shift.employeeId)).size);
  const before=Math.min(...counts),after=Math.max(0,before-1),otherLeaveCount=[...sameRole].filter(id=>id!==employeeId&&dates.some(day=>absent(id,day))).length;
  candidates.push({id:`${employeeId}:${balance.code}:${dates.join(',')}`,dates,hours,remainingHours:round(available-hours),affectedShifts:affected.length,otherLeaveCount,staffingBefore:before,staffingAfter:after,staffingBasis:'Minimum across the proposed dates of distinct same-role department employees with recorded assignments, excluding known absence dates. Daily counts, not simultaneous coverage or policy minima.',reason:`${affected.length} rostered ${affected.length===1?'shift':'shifts'}; ${otherLeaveCount} other same-role ${otherLeaveCount===1?'colleague has':'colleagues have'} recorded or pending leave. Recorded daily same-role assignments fall from at least ${before} to ${after}. Manager must verify patient demand, shift coverage and skill mix.`});
 }
 candidates.sort((a,b)=>a.otherLeaveCount-b.otherLeaveCount||b.staffingAfter-a.staffingAfter||a.hours-b.hours||a.dates[0].localeCompare(b.dates[0]));
 for(const candidate of candidates){if(plan.suggestions.some(suggestion=>suggestion.dates.some(day=>candidate.dates.includes(day))))continue;plan.suggestions.push(candidate);if(plan.suggestions.length===3)break;}
 if(!plan.suggestions.length)plan.reason+=' No non-overlapping rostered window with sufficient recorded balance was found in the planning fortnight.';
 if(reserved)plan.limitations.push(`${round(reserved)} hours are reserved by active workspace requests for this leave code.`);
 return plan;
}
