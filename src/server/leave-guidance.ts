import raw from '../data/workforce.json';
import policyRaw from '../data/policies.json';
import type {Booking,PolicyIndex,Workforce} from '../lib/workforce-types';
import {getDepartmentRoster,getLeave} from './workforce-db';
import {guidanceForAssessment} from '../lib/leave-guidance';
import {assessWithRequests,datesBetween} from '../lib/workforce-engine';
const workforce=raw as Workforce,policies=policyRaw as unknown as PolicyIndex;
export function bookedDepartmentAbsences(dates:string[],employeeId=workforce.employeeId){
 const sorted=[...dates].sort();if(!sorted.length)return [];
 const ids=new Set(getDepartmentRoster(workforce.unit,workforce.period.start,workforce.period.end).map(s=>s.employeeId));ids.delete(employeeId);
 const counts=new Map(dates.map(d=>[d,new Set<string>()]));
 for(const id of ids)for(const l of getLeave(id,sorted[0],sorted.at(-1)!)){
  if(l.recordType!=='Booked Leave'||/cancel|reject|declin/i.test(l.status))continue;
  for(const d of dates)if(d>=l.start&&d<=l.end)counts.get(d)!.add(id);
 }
 return dates.map(date=>({date,count:counts.get(date)!.size}));
}
export function assessWithGuidance(dates:string[],leaveCode:string,requests:Booking[]){
 const assessment=assessWithRequests(workforce,policies,dates,leaveCode,requests);
 if(requests.some(r=>!['declined','changes-requested','colleague-declined'].includes(r.status)&&r.dates.some(d=>dates.includes(d)))){
  assessment.canProceed=false;assessment.checks.push({id:'pending',label:'Existing request',status:'fail',detail:'An active request already covers one or more selected dates.',source:'Saved requests'});
 }
 return{assessment,guidance:guidanceForAssessment(assessment,dates,bookedDepartmentAbsences(dates),leaveCode)};
}
export function alternativeLeaveDates(dates:string[],leaveCode:string,requests:Booking[]){
 const period=datesBetween(workforce.period.start,workforce.period.end),length=Math.min(dates.length,period.length),original=assessWithRequests(workforce,policies,dates,leaveCode,requests);
 const absences=bookedDepartmentAbsences(period),options=[];
 for(let i=0;i<=period.length-length;i++){
  const candidate=period.slice(i,i+length);if(JSON.stringify(candidate)===JSON.stringify([...dates].sort()))continue;
  const assessment=assessWithRequests(workforce,policies,candidate,leaveCode,requests);
  if(!assessment.canProceed||assessment.hours<=0||requests.some(r=>!['declined','changes-requested','colleague-declined'].includes(r.status)&&r.dates.some(d=>candidate.includes(d))))continue;
  const otherBookedLeave=absences.filter(d=>candidate.includes(d.date)).reduce((sum,d)=>sum+d.count,0);
  options.push({dates:candidate,hours:assessment.hours,affectedShifts:assessment.shifts.length,otherBookedLeave,reason:`${assessment.shifts.length} affected shifts; ${otherBookedLeave} booked staff-days across the period. Clinical staffing still needs manager verification.`,sameHours:assessment.hours===original.hours});
 }
 return options.sort((a,b)=>Number(b.sameHours)-Number(a.sameHours)||a.otherBookedLeave-b.otherBookedLeave||a.dates[0].localeCompare(b.dates[0])).slice(0,3);
}
