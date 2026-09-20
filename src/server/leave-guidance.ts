import raw from '../data/workforce.json';
import policyRaw from '../data/policies.json';
import type {Booking,PolicyIndex,Workforce} from '../lib/workforce-types';
import {getDepartmentRoster,getLeave} from './workforce-db';
import {guidanceForAssessment} from '../lib/leave-guidance';
import {assessWithRequests,datesBetween} from '../lib/workforce-engine';
import {interval} from '../lib/staffing-requirements';
import {getStaffingFloors,staffingImpact} from './staffing-plan';
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
export async function assessWithGuidance(dates:string[],leaveCode:string,requests:Booking[]){
 const assessment=assessWithRequests(workforce,policies,dates,leaveCode,requests);
 if(requests.some(r=>!['declined','changes-requested','colleague-declined'].includes(r.status)&&r.dates.some(d=>dates.includes(d)))){
  assessment.canProceed=false;assessment.checks.push({id:'pending',label:'Existing request',status:'fail',detail:'An active request already covers one or more selected dates.',source:'Saved requests'});
 }
 const staffing=staffingImpact(dates,requests,await getStaffingFloors());
 const shortages=staffing.filter(s=>s.shortfall!==null&&s.shortfall>0);
 for(const s of staffing)assessment.checks.push({id:'staffing-floor',label:`${s.date} · ${s.band} · ${s.role}`,status:s.minimum===null||s.shortfall?'warning':'pass',detail:s.minimum===null?`No manager staffing minimum is configured for ${s.role} on ${s.date} (${s.band}). Coverage cannot yet be confirmed.`:`Your employee type (${s.role}) needs at least ${s.minimum} on ${s.date} (${s.band}). Rostered coverage: ${s.before}; after your leave: ${s.after}.${s.shortfall?` ${s.shortfall} additional clinician(s) required; this cannot be directly granted without resolving coverage.`:' The configured minimum is maintained; no additional cover is needed for this window.'}`,source:'Manager-defined operating floors; roster and recorded/pending leave'});
 assessment.reasons=assessment.checks.filter(c=>c.status!=='pass').map(c=>c.detail);
 if(shortages.length)assessment.summary='Cover is required before this leave can be granted';
 const guidance=guidanceForAssessment(assessment,dates,bookedDepartmentAbsences(dates),leaveCode);
 guidance.reasons.unshift(...assessment.checks.filter(c=>c.id==='staffing-floor'&&c.status==='warning').map(c=>c.detail));
 if(shortages.length){guidance.title='Your leave needs cover';guidance.subtitle='The request can go to your manager, but the staffing shortfall must be resolved.'}
 return{assessment,guidance,staffing};
}
export async function alternativeLeaveDates(dates:string[],leaveCode:string,requests:Booking[]){
 const period=datesBetween(workforce.period.start,workforce.period.end),original=assessWithRequests(workforce,policies,dates,leaveCode,requests),floors=await getStaffingFloors();
 const absences=bookedDepartmentAbsences(period),options=[];
 for(let i=0;i<period.length;i++)for(let j=i;j<period.length;j++){
  const candidate=period.slice(i,j+1);if(JSON.stringify(candidate)===JSON.stringify([...dates].sort()))continue;
  const assessment=assessWithRequests(workforce,policies,candidate,leaveCode,requests);
  if(!assessment.canProceed||assessment.hours!==original.hours||assessment.hours<=0||requests.some(r=>!['declined','changes-requested','colleague-declined'].includes(r.status)&&r.dates.some(d=>candidate.includes(d))))continue;
  if(!assessment.shifts.some(s=>s.date===candidate[0])||!assessment.shifts.some(s=>s.date===candidate.at(-1)))continue;
  const staffing=staffingImpact(candidate,requests,floors),noAdditionalCover=staffing.length>0&&staffing.every(s=>s.minimum!==null&&s.shortfall===0),shortfall=staffing.reduce((n,s)=>n+(s.shortfall||0),0);
  const otherBookedLeave=absences.filter(d=>candidate.includes(d.date)).reduce((sum,d)=>sum+d.count,0);
  options.push({dates:candidate,hours:assessment.hours,affectedShifts:assessment.shifts.length,otherBookedLeave,staffing,noAdditionalCover,shortfall,reason:noAdditionalCover?'No additional cover needed against all configured affected staffing floors. Manager approval and clinical checks still apply.':shortfall?'Additional cover is needed against the configured staffing floors.':'Some affected staffing minima are not configured. Cover requirements remain unverified.',sameHours:true});
 }
 const leaveOptions=options.sort((a,b)=>Number(b.noAdditionalCover)-Number(a.noAdditionalCover)||a.shortfall-b.shortfall||a.otherBookedLeave-b.otherBookedLeave||a.dates[0].localeCompare(b.dates[0])).slice(0,3);
 const offDutyDates=period.filter(d=>{const start=Date.parse(d+'T00:00:00Z'),end=start+86400000;return !workforce.shifts.some(s=>{const [a,b]=interval(s);return s.employeeId===workforce.employeeId&&a<end&&start<b})&&!workforce.leave.some(l=>l.employeeId===workforce.employeeId&&!/cancel|reject|declin/i.test(l.status)&&l.start.slice(0,10)<=d&&l.end.slice(0,10)>=d)&&!requests.some(r=>r.employeeId===workforce.employeeId&&!['declined','changes-requested','colleague-declined'].includes(r.status)&&r.dates.includes(d))});
 return{options:leaveOptions,offDuty:{dates:offDutyDates,reason:'Fully off-duty dates with no overlapping recorded or pending leave. No paid leave is required on these dates.'}};
}
