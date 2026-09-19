'use client';
import {useState} from 'react';
import {AlertCircle,CheckCircle2,Bell} from 'lucide-react';
import type {Assessment,Workforce} from '@/lib/workforce-types';
import {guidanceForAssessment} from '@/lib/leave-guidance';
export default function RequestOutcome({assessment,dates,leaveCode,workforce,onChat}:{assessment:Assessment;dates:string[];leaveCode:string;workforce:Workforce;onChat:(prompt:string)=>void}){
 const [watch,setWatch]=useState(false);
 const staff=new Set(workforce.employees.filter(e=>e.unit===workforce.unit&&e.id!==workforce.employeeId).map(e=>e.id));
 const absences=dates.map(date=>({date,count:new Set(workforce.leave.filter(l=>staff.has(l.employeeId)&&l.recordType==='Booked Leave'&&!/cancel|reject|declin/i.test(l.status)&&date>=l.start&&date<=l.end).map(l=>l.employeeId)).size}));
 const result=guidanceForAssessment(assessment,dates,absences,leaveCode);
 return <section className={`wf-outcome ${result.status}`}><div>{result.status==='changes'?<AlertCircle size={24}/>:<CheckCircle2 size={24}/>}<h3>{result.title}</h3></div><p>{result.subtitle}</p><ul>{result.reasons.map((reason,i)=><li key={i}>{reason}</li>)}</ul><div className="wf-actions">{result.actions.filter(a=>a.id!=='prepare').map(a=><button className="wf-secondary" key={a.id} onClick={()=>a.kind==='watch'?setWatch(true):onChat(a.prompt!)}>{a.label}</button>)}</div>{watch&&<div className="wf-watch"><Bell size={18}/><span><strong>Cancellation watch · {dates[0]} – {dates.at(-1)}</strong><small>Preview only: would check for cancelled leave in this period. Monitoring is not active and no notifications will be sent.</small></span></div>}</section>;
}
