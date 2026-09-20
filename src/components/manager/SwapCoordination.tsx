'use client';

import {useEffect,useState} from 'react';
import {CheckCircle2,Clock,LoaderCircle,Repeat2,Send,TriangleAlert} from 'lucide-react';
import raw from '@/data/workforce.json';
import type {Booking,Shift,SwapOption,Workforce} from '@/lib/workforce-types';
import './swap-coordination.css';

const data=raw as Workforce;
const name=(id:string)=>{
 if(id===data.employeeId)return 'Sarah Chen';
 const index=data.employees.findIndex(employee=>employee.id===id);
 if(index<0)return `Colleague ${id}`;
 return ['Emily','James','Priya','Daniel','Amelia','Oliver','Chloe','Ethan','Grace','Liam','Sophie','Noah','Aisha','Lucas','Isla','Mia'][index%16]+' '+['Zhang','Wilson','Kumar','Taylor','Nguyen','Patel','Williams','Brown','Martin','Lee','Thomas','Clarke','Harris','Wong','Walker'][Math.floor(index/16)%15];
};
const date=(value:string)=>new Date(value+'T12:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});
const shiftLabel=(shift:Shift)=>`${date(shift.date)} · ${shift.start}–${shift.end}`;
const hours=(value:number)=>Number(value.toFixed(1));

export default function SwapCoordination({booking,onUpdated}:{booking:Booking;onUpdated:(booking:Booking)=>void}){
 const [options,setOptions]=useState<SwapOption[]>([]);
 const [selected,setSelected]=useState(booking.swap?.id||'');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const invitation=booking.swapInvitation;
 const terminal=booking.status==='approved'||booking.status==='declined';

 useEffect(()=>{
  const controller=new AbortController();
  let generation=0;
  setNotice('');
  const load=async()=>{
   const current=++generation;
   setLoading(true);setError('');
   try{
    const response=await fetch(`/api/chat/swaps?requestId=${encodeURIComponent(booking.id)}`,{cache:'no-store',signal:controller.signal});
    const result=await response.json();
    if(!response.ok)throw new Error(result.message||'Unable to load swap options.');
    if(controller.signal.aborted||current!==generation)return;
    const available=(result.options||[]) as SwapOption[];
    const ordered=[...available].sort((a,b)=>Number(b.id===booking.swap?.id)-Number(a.id===booking.swap?.id));
    setOptions(ordered.slice(0,3));
    setSelected(ordered.find(option=>option.id===booking.swap?.id)?.id||ordered[0]?.id||'');
   }catch(cause){
    if(!controller.signal.aborted&&current===generation){setOptions([]);setError(cause instanceof Error?cause.message:'Unable to load swap options.');}
   }finally{if(!controller.signal.aborted&&current===generation)setLoading(false);}
  };
  void load();
  window.addEventListener('gimme:session',load);
  return()=>{controller.abort();window.removeEventListener('gimme:session',load);};
 },[booking.id,booking.swap?.id,booking.status,invitation?.status]);

 async function update(status?:'accepted'|'declined'){
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/chat/swaps',{
    method:status?'PATCH':'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(status?{requestId:booking.id,status}:{requestId:booking.id,swapId:selected})
   });
   const result=await response.json();
   if(!response.ok)throw new Error(result.message||'Unable to update the swap invitation.');
   onUpdated(result.request);
   setNotice(result.message||'Swap invitation updated.');
   window.dispatchEvent(new CustomEvent('gimme:server-request'));
  }catch(cause){setError(cause instanceof Error?cause.message:'Unable to update the swap invitation.');}
  finally{setBusy(false);}
 }

 const choice=options.find(option=>option.id===selected);
 return <section className="swap-coordination" aria-label="Swap coordination">
  <div className="swap-heading"><h3><Repeat2 size={19}/>Shift swap options</h3><span>{loading?'Checking…':`${options.length} available`}</span></div>
  {loading?<p className="swap-muted"><LoaderCircle size={16} className="swap-spin"/>Checking current roster and requirements…</p>:<>
   {options.length>0?<div className="swap-options">{options.map(option=><article className={`swap-option ${selected===option.id?'is-selected':''}`} key={option.id}>
    <label className="swap-choice"><input type="radio" name={`swap-${booking.id}`} value={option.id} checked={selected===option.id} disabled={busy||terminal||invitation?.status==='pending'||invitation?.status==='accepted'} onChange={()=>setSelected(option.id)}/><strong>{name(option.employeeId)}</strong><span>{option.kind==='swap'?'Reciprocal swap':'Shift cover'}</span></label>
    <ul className="swap-shifts"><li><b>They take:</b> {shiftLabel(option.outgoing)}</li><li><b>{name(booking.employeeId)} takes:</b> {option.returnShift?shiftLabel(option.returnShift):'No return shift'}</li></ul>
    <p className="swap-hours"><Clock size={14}/>Colleague’s fortnight: <b>{hours(option.candidateHoursBefore)} → {hours(option.candidateHoursAfter)}h</b></p>
    <details><summary>How this fits the requirements</summary><p className="swap-hours">{name(booking.employeeId)}’s fortnight: {hours(option.requesterHoursBefore)} → {hours(option.requesterHoursAfter)}h</p><ul className="swap-checks">{option.checks.map((check,index)=><li key={`${check.id}-${index}`} className={`swap-check-${check.status}`}><span>{check.status==='pass'?<CheckCircle2 size={15}/>:<TriangleAlert size={15}/>}<b>{check.label}</b></span><p>{check.detail}</p>{check.source&&<small>{check.source}</small>}</li>)}</ul>{option.unresolved.length>0&&<div className="swap-unresolved"><b>Still needs manager review</b><ul>{option.unresolved.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}</details>
   </article>)}</div>:!error&&<p className="swap-muted">No current swap options found. Review alternative leave dates or arrange cover separately.</p>}
   {choice&&!terminal&&invitation?.status!=='pending'&&invitation?.status!=='accepted'&&<button className="wf-primary swap-send" disabled={busy||choice.checks.some(check=>check.status==='fail')} onClick={()=>void update()}>{busy?<LoaderCircle size={16}/>:<Send size={16}/>}Send swap invitation to {name(choice.employeeId)}</button>}
  </>}
  {invitation&&<div className="swap-inbox"><div className="swap-heading"><h4>Colleague inbox preview</h4><span>{invitation.status==='pending'?'Awaiting response':invitation.status==='accepted'?'Acceptance recorded':'Decline recorded'}</span></div><p><b>To {name(invitation.recipientId)}</b></p><blockquote>{invitation.message}</blockquote><small>Saved in this app. No external email or Teams message is sent.</small>{invitation.status==='pending'&&!terminal&&<><p className="swap-response-note">After speaking with the colleague, record their response below. This is a manager-recorded response.</p><div className="swap-response-actions"><button className="wf-secondary" disabled={busy} onClick={()=>void update('accepted')}>Record acceptance</button><button className="wf-secondary" disabled={busy} onClick={()=>void update('declined')}>Record decline</button></div></>}{invitation.status==='accepted'&&<p className="swap-response-note">The manager has recorded acceptance. Final leave approval is still required.</p>}</div>}
  {error&&<p className="wf-error" role="alert">{error}</p>}
  {notice&&<p className="swap-notice" role="status">{notice}</p>}
 </section>;
}
