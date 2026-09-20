import type {Workforce,Shift} from './workforce-types';
export const roles=['Registered Nurse','Clinical Nurse','Enrolled Nurse','Assistant in Nursing','Consultant Medical Officer','Resident Medical Officer','Medical Registrar','Pharmacist','Occupational Therapist','Technical Clinician'];
export const bands=[{name:'Day',start:'07:00',end:'15:30'},{name:'Evening',start:'13:00',end:'21:30'},{name:'Night',start:'21:00',end:'07:30'}];
export type Floors=Record<string,number|null>;
export const floorKey=(date:string,band:number,role:string)=>date+'|'+band+'|'+role;
export function interval(s:Pick<Shift,'date'|'start'|'end'>){const a=Date.parse(s.date+'T'+s.start+':00Z');let b=Date.parse(s.date+'T'+s.end+':00Z');if(b<=a)b+=86400000;return [a,b]}
export function coverage(w:Workforce,date:string,band:number,role:string,removeId?:string){
 const [a,b]=interval({date,...bands[band]});
 const employees=new Set(w.employees.filter(e=>e.role===role).map(e=>e.id));
 const spans=w.shifts.filter(s=>s.unit===w.unit&&employees.has(s.employeeId)&&s.id!==removeId).filter(s=>{
  const [x,y]=interval(s);
  return x<b&&y>a&&!w.leave.some(l=>l.employeeId===s.employeeId&&!/cancel|reject|declin/i.test(l.status)&&Date.parse(l.start.slice(0,10)+'T00:00:00Z')<y&&Date.parse(l.end.slice(0,10)+'T00:00:00Z')+86400000>x)
 }).map(s=>({id:s.employeeId,span:interval(s)}));
 const points=[...new Set([a,...spans.flatMap(s=>s.span).filter(t=>t>a&&t<b)])].sort((x,y)=>x-y);
 return Math.min(...points.map(t=>new Set(spans.filter(s=>s.span[0]<=t&&s.span[1]>t).map(s=>s.id)).size));
}
export function applyFloors(current:Floors,draft:(number|null)[],dates:string[],selectedDate:string,selectedBand:number,scope:string){
 const copy={...current};const targets=scope==='shift'||scope==='day'?[selectedDate]:dates;
 for(const date of targets)for(const band of scope==='day'||scope==='fortnight'?[0,1,2]:[selectedBand])roles.forEach((role,i)=>{copy[floorKey(date,band,role)]=draft[i]});
 return copy;
}

