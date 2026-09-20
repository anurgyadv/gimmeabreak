'use client';
import {useState,useEffect} from 'react';
import {AlertCircle,CheckCircle2,Bell} from 'lucide-react';
import type {Assessment,Workforce} from '@/lib/workforce-types';
import {guidanceForAssessment} from '@/lib/leave-guidance';
export default function RequestOutcome({assessment,dates,leaveCode,workforce,onChat,requestId}:{requestId?:string;assessment:Assessment;dates:string[];leaveCode:string;workforce:Workforce;onChat:(prompt:string)=>void}){
 const [watch,setWatch]=useState(false);
 const [result,setResult]=useState<ReturnType<typeof guidanceForAssessment>|null>(null);
 const [error,setError]=useState(false);
 const dateKey=dates.join(',');
 useEffect(()=>{let live=true;setResult(null);setError(false);void(async()=>{
 await fetch('/api/chat/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:location.hash.startsWith('#manager')?'manager':'employee'})});
 const response=await fetch('/api/chat/assessment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dates:dateKey.split(','),leaveCode,requestId})});
 if(!response.ok)throw new Error('Assessment unavailable');const body=await response.json();if(live)setResult(body.guidance);
 })().catch(()=>{if(live)setError(true)});return()=>{live=false};},[dateKey,leaveCode,requestId]);
 if(!result)return <section className="wf-outcome"><p>{error?'Staffing check unavailable. Please reopen this request to retry.':'Checking your balance and shared staffing requirements…'}</p></section>;
 return <section className={`wf-outcome ${result.status}`}><div>{result.status==='changes'?<AlertCircle size={24}/>:<CheckCircle2 size={24}/>}<h3>{result.title}</h3></div><p>{result.subtitle}</p><ul>{result.reasons.map((reason,i)=><li key={i}>{reason}</li>)}</ul><div className="wf-actions">{result.actions.filter(a=>a.id!=='prepare').map(a=><button className="wf-secondary" key={a.id} onClick={()=>a.kind==='watch'?setWatch(true):onChat(a.prompt!)}>{a.label}</button>)}</div>{watch&&<div className="wf-watch"><Bell size={18}/><span><strong>Cancellation watch · {dates[0]} – {dates.at(-1)}</strong><small>Preview only: would check for cancelled leave in this period. Monitoring is not active and no notifications will be sent.</small></span></div>}</section>;
}
