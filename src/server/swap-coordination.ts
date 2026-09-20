import raw from '../data/workforce.json';
import policyRaw from '../data/policies.json';
import type {Workforce,PolicyIndex,Booking,SwapOption} from '../lib/workforce-types';
import {findAvailableSwaps,assessWithRequests,interval,round} from '../lib/workforce-engine';
import {listBookings,saveBooking,audit,withEmployeeLock} from './chat-store';
const w=raw as Workforce,p=policyRaw as unknown as PolicyIndex;
export function swapWorkImpact(option:SwapOption,workforce:Workforce=w){
 const duty=option.outgoing;
 const schedule=workforce.shifts.filter(s=>s.employeeId===option.employeeId&&s.id!==option.returnShift?.id);
 const [start,end]=interval(duty);
 const before=schedule.filter(s=>interval(s)[1]<=start).sort((a,b)=>interval(b)[1]-interval(a)[1])[0];
 const after=schedule.filter(s=>interval(s)[0]>=end).sort((a,b)=>interval(a)[0]-interval(b)[0])[0];
 const band=(s:typeof duty)=>Number(s.start.slice(0,2))>=20||Number(s.start.slice(0,2))<6?'night':Number(s.start.slice(0,2))>=12?'evening':'day';
 const minimum=(a:typeof duty,b:typeof duty)=>[band(a),band(b)].includes('night')&&[band(a),band(b)].includes('day')?20:9.5;
 const minBefore=before?minimum(before,duty):null,minAfter=after?minimum(duty,after):null;
 return{hoursBefore:option.candidateHoursBefore,hoursAfter:option.candidateHoursAfter,contractHours:workforce.employees.find(e=>e.id===option.employeeId)?.contractHours??0,restBeforeHours:before?round((start-interval(before)[1])/3600000):null,restAfterHours:after?round((interval(after)[0]-end)/3600000):null,minimumRestHours:minBefore===null&&minAfter===null?null:Math.max(minBefore??0,minAfter??0),restBeforeMinimumHours:minBefore,restAfterMinimumHours:minAfter};
}
export async function replyToSwap(employeeId:string,requestId:string,status:'accepted'|'declined',reason:string,source:'teams-preview'|'manager-recorded',invitationId?:string,recipientId?:string){
 if(reason.length>500||status==='declined'&&!reason.trim())throw new Error('Provide a short reason for declining (up to 500 characters).');
 return withEmployeeLock(employeeId,async()=>{
  const all=await listBookings(employeeId),b=all.find(r=>r.id===requestId),invite=b?.swapInvitation;
  if(!b||b.status!=='manager-review'||!invite||invite.status!=='pending')throw new Error('No pending invitation for this request.');
  if(invitationId&&invite.id!==invitationId||recipientId&&invite.recipientId!==recipientId)throw new Error('This confirmation expired or belongs to a replaced invitation.');
  if(status==='accepted'&&!findAvailableSwaps(w,p,b.dates,all,b.id).some(o=>o.id===b.swap?.id))throw new Error('This arrangement no longer passes the roster checks.');
  const at=new Date().toISOString(),declined=status==='declined';
  const request:Booking={...b,swap:declined?null:b.swap,assessment:declined?assessWithRequests(w,p,b.dates,b.leaveCode,all.filter(r=>r.id!==b.id)):b.assessment,swapInvitation:{...invite,option:invite.option||b.swap||undefined,status,reason:reason.trim(),responseSource:source,respondedAt:at},events:[...b.events,{at,label:source==='teams-preview'?`Colleague ${status} in Teams preview`:`Manager recorded colleague ${status}`,detail:`${reason.trim()||'Acceptance recorded.'} ${source==='teams-preview'?'Simulated colleague response; no Microsoft Teams connection.':'Recorded by the manager; not an authenticated colleague response.'} Manager decision still required.`}]};
  await saveBooking(request);await audit(employeeId,'swap-response',{requestId,status,source,reason:reason.trim()});return request;
 });
}
