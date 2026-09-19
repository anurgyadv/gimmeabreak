import type {Workforce,PolicyIndex,Shift,Assessment,SwapOption,Balance,Employee,Booking} from './workforce-types';
export const round=(n:number)=>Math.round(n*100)/100;
export const datesBetween=(start:string,end:string)=>{const days:string[]=[];for(let t=Date.parse(start+'T00:00:00Z');t<=Date.parse(end+'T00:00:00Z');t+=86400000)days.push(new Date(t).toISOString().slice(0,10));return days};
export function interval(s:Shift):[number,number]{const a=Date.parse(`${s.date}T${s.start}:00Z`);let b=Date.parse(`${s.date}T${s.end}:00Z`);if(b<=a)b+=86400000;return[a,b]}
const overlaps=(a:Shift,b:Shift)=>{const[x,y]=interval(a),[u,v]=interval(b);return x<v&&u<y};
export const inPeriod=(w:Workforce,s:Shift)=>s.date>=w.period.start&&s.date<=w.period.end;
export const mine=(w:Workforce,id=w.employeeId)=>w.shifts.filter(s=>s.employeeId===id&&inPeriod(w,s));
export function latestBalances(w:Workforce,id:string):Balance[]{const map=new Map<string,Balance>();for(const b of w.balances)if(b.employeeId===id&&b.effectiveDate<=w.period.decisionDate&&(!map.has(b.code)||map.get(b.code)!.effectiveDate<b.effectiveDate))map.set(b.code,b);return [...map.values()].sort((a,b)=>a.code.localeCompare(b.code))}
const hasLeave=(w:Workforce,id:string,dates:string[])=>w.leave.some(l=>l.employeeId===id&&!/cancel|reject|declin/i.test(l.status)&&dates.some(d=>d>=l.start.slice(0,10)&&d<=l.end.slice(0,10)));
export function assess(w:Workforce,p:PolicyIndex,dates:string[],code:string):Assessment{
 const selected=[...new Set(dates)].sort(),shifts=mine(w).filter(s=>selected.includes(s.date)),hours=round(shifts.reduce((n,s)=>n+s.netHours,0)),balance=latestBalances(w,w.employeeId).find(b=>b.code===code)||null;
 const valid=selected.length>0&&selected.every(d=>d>=w.period.start&&d<=w.period.end),duplicate=hasLeave(w,w.employeeId,selected),enough=!!balance&&balance.remainingHours>=hours;
 const ratio=p.documents.find(d=>/ratio/i.test(d.title)),award=p.documents.find(d=>/Australian Nursing|ANF|Nursing Federation/i.test(d.title)),accrued=p.documents.find(d=>/Accrued/i.test(d.title));
 const checks:Assessment['checks']=[
 {id:'balance',label:'Checking leave balances',status:enough?'pass':'fail',detail:balance?`${round(balance.remainingHours)}h available · ${hours}h requested · ${round(balance.remainingHours-hours)}h remaining`:'No current balance for this leave type.',source:`Leave balances · ${balance?.effectiveDate||'no snapshot'}`,policyId:accrued?.id},
 {id:'roster',label:'Checking rostered shifts',status:!valid||duplicate?'fail':shifts.length?'warning':'pass',detail:!valid?'Select dates within the next fortnight.':duplicate?'These dates overlap a recorded absence.':`${shifts.length} rostered ${shifts.length===1?'shift':'shifts'} affected · ${hours} paid hours`,source:'Roster + leave taken CSVs'},
 {id:'policy',label:'Checking leave policy',status:'warning',detail:'Supervisor approval is required. Leave entitlement and timing are assessed under the applicable agreement.',source:award?.title||'Applicable industrial agreement',policyId:award?.id},
 {id:'mix',label:'Checking department skill mix',status:shifts.length?'warning':'pass',detail:shifts.length?'Patient census, ward scope and competency records need manager verification. Headcount alone cannot prove safe staffing.':'No rostered shift is removed on these dates.',source:ratio?.number||'MP0187/24',policyId:ratio?.id},
 {id:'swap',label:'Checking swap requirements',status:shifts.length?'warning':'pass',detail:shifts.length?'With your permission, compare same-role cover and both sides of a shift swap.':'No shift replacement needed.',source:'Contracts + roster + leave records'}];
 return{hours,shifts,balance,balanceRemaining:balance?round(balance.remainingHours-hours):null,checks,reasons:checks.filter(c=>c.status!=='pass').map(c=>c.detail),canProceed:valid&&!duplicate&&enough,summary:!valid||duplicate||!enough?'Your request needs an update':shifts.length?'Your leave needs a staffing review':'No roster impact — ready for review'};
}
const absentDuring=(w:Workforce,id:string,s:Shift,extra:string[]=[])=>{const [a,b]=interval(s);return [...w.leave.filter(l=>l.employeeId===id&&!/cancel|reject|declin/i.test(l.status)).map(l=>[Date.parse(l.start.slice(0,10)+'T00:00:00Z'),Date.parse(l.end.slice(0,10)+'T00:00:00Z')+86400000]),...extra.map(d=>[Date.parse(d+'T00:00:00Z'),Date.parse(d+'T00:00:00Z')+86400000])].some(([x,y])=>a<y&&x<b)};
const band=(s:Shift)=>Number(s.start.slice(0,2))>=20||Number(s.start.slice(0,2))<6?'night':Number(s.start.slice(0,2))>=12?'evening':'day';
function validSchedule(shifts:Shift[]){const sorted=[...shifts].sort((a,b)=>interval(a)[0]-interval(b)[0]);for(let i=1;i<sorted.length;i++){const a=sorted[i-1],b=sorted[i];const gap=(interval(b)[0]-interval(a)[1])/3600000;const required=((band(a)==='night'&&band(b)==='day')||(band(a)==='day'&&band(b)==='night'))?20:9.5;if(gap<required)return false}let nightRun=0;for(const s of sorted){nightRun=band(s)==='night'&&(interval(s)[1]-interval(s)[0])/3600000>=10?nightRun+1:0;if(nightRun>5)return false}const days=[...new Set(sorted.map(s=>s.date))].sort();let run=1;for(let i=1;i<days.length;i++){run=Date.parse(days[i])-Date.parse(days[i-1])===86400000?run+1:1;if(run>7)return false}return true}
function contractValid(e:Employee,date:string){return e.contractStart<=date&&(!e.contractEnd||(/^\d{4}-\d{2}-\d{2}$/.test(e.contractEnd)&&e.contractEnd>=date))}
export function findSwaps(w:Workforce,p:PolicyIndex,dates:string[]):SwapOption[]{
 const me=w.employees.find(e=>e.id===w.employeeId)!;if(me.industrialInstrument&&me.industrialInstrument!=='ANF_2024')return [];const allMine=w.shifts.filter(s=>s.employeeId===me.id),affected=mine(w).filter(s=>dates.includes(s.date)),options:SwapOption[]=[];
 const unknown=(w.quality.unresolvedContractEmployeeIds||[]) as string[];
 for(const outgoing of affected){for(const e of w.employees){if(e.id===me.id||e.role!==me.role||e.rate!==me.rate||unknown.includes(e.id)||!contractValid(e,outgoing.date)||absentDuring(w,e.id,outgoing))continue;
 const original=w.shifts.filter(s=>s.employeeId===e.id);if(original.some(s=>overlaps(s,outgoing)))continue;
 const possible=[...original.filter(s=>inPeriod(w,s)&&!dates.includes(s.date)&&s.netHours===outgoing.netHours),null];
 for(const back of possible){if(back&&(!contractValid(me,back.date)||absentDuring(w,me.id,back,dates)||allMine.some(s=>s.id!==outgoing.id&&overlaps(s,back))))continue;
 const ownNew=allMine.filter(s=>s.id!==outgoing.id).concat(back?[back]:[]),otherNew=original.filter(s=>s.id!==back?.id).concat(outgoing);
 if(!validSchedule(ownNew)||!validSchedule(otherNew))continue;
 const sum=(ss:Shift[])=>round(ss.filter(s=>inPeriod(w,s)).reduce((n,s)=>n+s.netHours,0));
 const before=sum(allMine),after=sum(ownNew),cb=sum(original),ca=sum(otherNew);
 const fullDaysOff=(ss:Shift[])=>datesBetween(w.period.start,w.period.end).filter(d=>!ss.some(s=>{const [a,b]=interval(s),start=Date.parse(d+'T00:00:00Z');return a<start+86400000&&b>start})).length;
 const nightCount=(ss:Shift[])=>ss.filter(s=>inPeriod(w,s)&&band(s)==='night'&&(interval(s)[1]-interval(s)[0])/3600000>=10).length;
 if(fullDaysOff(ownNew)<4||fullDaysOff(otherNew)<4||nightCount(ownNew)>8||nightCount(otherNew)>8)continue;
 // Paid leave still consumes the requester's contracted hours; equal-hour swaps replace leave, cover does not.
 if(after+(back?0:outgoing.netHours)>me.contractHours||ca>e.contractHours||ownNew.filter(s=>inPeriod(w,s)).length>10||otherNew.filter(s=>inPeriod(w,s)).length>10)continue;
 options.push({id:`${outgoing.id}|${e.id}|${back?.id||'cover'}`,employeeId:e.id,kind:back?'swap':'cover',outgoing,returnShift:back,requesterHoursBefore:before,requesterHoursAfter:after,candidateHoursBefore:cb,candidateHoursAfter:ca,checks:[
 {id:'role',label:'Same role and recorded grade',status:'pass',detail:`${e.role} · ${e.rate}`,source:'Employee contracts'},
 {id:'availability',label:'Both schedules checked',status:'pass',detail:'No overlapping roster or recorded leave; contract dates cover the proposed duties.',source:'Rosters + leave + contracts'},
 {id:'rest',label:'Rest, duties and hours checked',status:'pass',detail:`20h night/day transition; 9.5h conservative floor otherwise; ≤7 consecutive, ≤10 fortnight duties and ≥4 full days off. ${ca}/${e.contractHours}h candidate roster.`,source:'ANF 2024 cl28(11–15); contracts'},
 {id:'impact',label:'Original team coverage preserved',status:'pass',detail:back?'You cover the colleague’s original shift. Neither department loses a rostered position.':'The colleague is off duty. No existing shift is removed.',source:'Bilateral roster simulation'}],unresolved:['Manager must verify patient demand, applicable staffing requirements and competencies.','Colleague agreement is required.']});break;
 }
 }}return options.sort((a,b)=>Number(b.kind==='swap')-Number(a.kind==='swap')).slice(0,24);
}
export function canApprove(b:{status:string;assessment:Assessment},verified:boolean){return b.status==='manager-review'&&b.assessment.canProceed&&verified}

// Reserve existing local requests; a proposed colleague is not offered twice before resolution.
export const activeRequests=(requests:Booking[],exclude?:string)=>requests.filter(r=>r.id!==exclude&&!['declined','changes-requested','colleague-declined'].includes(r.status));
export function assessWithRequests(w:Workforce,p:PolicyIndex,dates:string[],code:string,requests:Booking[]):Assessment{
 const held=activeRequests(requests).filter(r=>r.leaveCode===code).reduce((n,r)=>n+r.assessment.hours-(r.swap?.kind==='swap'?r.swap.outgoing.netHours:0),0);
 const adjusted={...w,balances:w.balances.map(b=>b.employeeId===w.employeeId&&b.code===code?{...b,remainingHours:Math.max(0,b.remainingHours-held)}:b)};
 const result=assess(adjusted,p,dates,code);if(held)result.checks[0].detail+=` · ${round(held)}h reserved by other app requests`;return result;
}
export function findAvailableSwaps(w:Workforce,p:PolicyIndex,dates:string[],requests:Booking[],exclude?:string){
 const active=activeRequests(requests,exclude),busy=new Set(active.flatMap(r=>r.swap?[r.swap.employeeId]:[])),heldDates=new Set(active.flatMap(r=>[...r.dates,...(r.swap?.returnShift?[r.swap.returnShift.date]:[])]));
 return findSwaps(w,p,dates).filter(o=>!busy.has(o.employeeId)&&(!o.returnShift||!heldDates.has(o.returnShift.date))&&!heldDates.has(o.outgoing.date));
}
export function projectedRoster(w:Workforce,requests:Booking[]){let shifts=[...w.shifts];for(const r of requests.filter(r=>r.status==='approved')){for(const s of r.assessment.shifts){shifts=shifts.filter(x=>x.id!==s.id);if(r.swap?.outgoing.id===s.id)shifts.push({...s,employeeId:r.swap.employeeId})}if(r.swap?.returnShift){shifts=shifts.filter(x=>x.id!==r.swap!.returnShift!.id);shifts.push({...r.swap.returnShift,employeeId:r.employeeId})}}return shifts}

export function afterSwap(a:Assessment,o:SwapOption|null):Assessment{if(!o||o.kind!=='swap')return a;const debit=round(Math.max(0,a.hours-o.outgoing.netHours)),remaining=a.balance?round(a.balance.remainingHours-debit):null;const checks=a.checks.map(c=>c.id==='balance'?{...c,status:remaining!==null&&remaining>=0?'pass' as const:'fail' as const,detail:`${a.balance?.remainingHours??0}h available · ${debit}h paid leave + ${o.outgoing.netHours}h shift swap · ${remaining??0}h remaining`}:c);return {...a,balanceRemaining:remaining,checks,canProceed:!checks.some(c=>c.status==='fail'),reasons:checks.filter(c=>c.status!=='pass').map(c=>c.detail)}}

export function submitForReview(w:Workforce,p:PolicyIndex,b:Booking,requests:Booking[],at:string):Booking|null{
 const swap=b.status==='colleague-declined'?null:b.swap;const fresh=assessWithRequests(w,p,b.dates,b.leaveCode,requests.filter(r=>r.id!==b.id));const assessment=afterSwap(fresh,swap);if(!assessment.canProceed)return null;
 return {...b,swap,assessment,status:'manager-review',submittedAt:b.submittedAt||at,events:[...b.events,{at,label:'Sent for manager review',detail:swap?'Colleague response preview accepted; manager must confirm actual agreement.':'Submitted without proposed colleague cover.'}]};
}
