'use client';
import {useCallback,useEffect,useState} from 'react';
import {ArrowLeft,Bell,CalendarDays,Check,ChevronDown,Clock3,Grid2X2,MessageSquare,MoreHorizontal,RefreshCw,Search,ShieldCheck,Users,X} from 'lucide-react';
import type {Booking,Shift,SwapOption} from '@/lib/workforce-types';
import './teams.css';

type PreviewRequest={booking:Booking;recipientName:string;impact:{hoursBefore:number;hoursAfter:number;contractHours:number;restBeforeHours:number|null;restAfterHours:number|null;minimumRestHours:number|null;restBeforeMinimumHours:number|null;restAfterMinimumHours:number|null};replyToken:string|null};
type InvitationSnapshot=NonNullable<Booking['swapInvitation']>&{option?:SwapOption;reason?:string};
const number=(n:number)=>new Intl.NumberFormat('en-AU',{maximumFractionDigits:1}).format(n);
const date=(value:string)=>new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});
const time=(value:string)=>value.includes('T')?value.split('T')[1].slice(0,5):value.slice(0,5);
const rest=(n:number|null)=>n===null?'Not recorded':n>=24?`${Math.floor(n/24)}d ${number(n%24)}h`:`${number(n)}h`;
function ShiftBlock({shift,label,tone}:{shift:Shift;label:string;tone:'take'|'give'}){
 return <div className={`tp-shift tp-shift-${tone}`}><span>{label}</span><strong>{date(shift.date)}</strong><div>{time(shift.start)}–{time(shift.end)} · {number(shift.netHours)}h</div><small>{shift.unitName.replace(/^SU\d+\s*[–—-]?\s*/i,"").replace(/synthetic\s*/ig,"")}</small></div>;
}
export default function TeamsPreview(){
 const [requests,setRequests]=useState<PreviewRequest[]>([]),[selected,setSelected]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reply,setReply]=useState<'accepted'|'declined'|null>(null),[reason,setReason]=useState('');
 const refresh=useCallback(async(bootstrap=false)=>{
  setError('');setLoading(true);
  try{
   if(bootstrap){const session=await fetch('/api/chat/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'manager'})});if(!session.ok)throw new Error('Could not open the preview. Please try again.');}
   const requestId=new URLSearchParams(window.location.search).get('requestId');
   const response=await fetch(`/api/teams-preview${requestId?`?requestId=${encodeURIComponent(requestId)}`:''}`,{cache:'no-store'});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load invitations.');
   const next:PreviewRequest[]=data.requests||[];setRequests(next);setSelected(current=>next.some(r=>r.booking.id===current)?current:next[0]?.booking.id||'');
  }catch(e){setError(e instanceof Error?e.message:'Could not load invitations.');}finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh(true)},[refresh]);
 const current=requests.find(r=>r.booking.id===selected),booking=current?.booking,invitation=booking?.swapInvitation as InvitationSnapshot|undefined,option=booking?.swap||invitation?.option;
 const canReply=!!current?.replyToken&&invitation?.status==='pending';
 async function sendReply(){
  if(!current?.replyToken||!reply||(reply==='declined'&&!reason.trim()))return;
  setBusy(true);setError('');
  try{const response=await fetch('/api/teams-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:current.replyToken,status:reply,reason:reason.trim()})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not send your response.');setReply(null);setReason('');await refresh();}
  catch(e){setError(e instanceof Error?e.message:'Could not send your response.');}finally{setBusy(false);}
 }
 return <div className="tp-shell">
  <div className="tp-preview-note"><span>Teams preview · simulated colleague response</span><a href="/#manager-requests"><ArrowLeft size={14}/> Back to manager</a></div>
  <header className="tp-topbar"><div className="tp-wordmark"><Grid2X2 size={20}/><strong>Teams</strong></div><div className="tp-search"><Search size={17}/><span>Search in Teams</span></div><div className="tp-self" aria-label="Colleague preview">{(current?.recipientName||'Colleague').split(' ').map(s=>s[0]).slice(0,2).join('')}</div></header>
  <div className="tp-layout">
   <nav className="tp-rail" aria-label="Preview app navigation"><span><Bell/><small>Activity</small></span><span className="tp-rail-active"><MessageSquare/><small>Chat</small></span><span><Users/><small>Teams</small></span><span><CalendarDays/><small>Calendar</small></span><span><MoreHorizontal/><small>More</small></span></nav>
   <aside className="tp-sidebar"><div className="tp-sidebar-title"><h1>Chat</h1><MoreHorizontal size={20}/></div><div className="tp-chat-filters"><span className="tp-filter-active">All</span><span>Unread</span><span>Chats</span></div><p className="tp-favourites"><ChevronDown size={14}/> Favourites</p><div className="tp-chat-selected"><div className="tp-bot-avatar">g!</div><div><strong>GimmeABreak</strong><small>Shift swap invitations</small></div>{requests.filter(r=>r.booking.swapInvitation?.status==='pending').length>0&&<span className="tp-count">{requests.filter(r=>r.booking.swapInvitation?.status==='pending').length}</span>}</div><p className="tp-sidebar-caption">Your leave coordination assistant</p><div className="tp-sidebar-bottom">Preview only. No message is sent through Microsoft Teams.</div></aside>
   <section className="tp-conversation" aria-label="GimmeABreak conversation"><header className="tp-conversation-header"><div className="tp-bot-avatar">g!</div><div><strong>GimmeABreak</strong><small>{current?`Chat with ${current.recipientName}`:'Leave coordination'}</small></div><button type="button" aria-label="Refresh invitations" disabled={loading||busy} onClick={()=>void refresh()}><RefreshCw size={18}/></button></header>
    {requests.length>1&&<div className="tp-recipient-picker"><label htmlFor="tp-invitation">Viewing invitation for</label><select id="tp-invitation" value={selected} onChange={e=>{setSelected(e.target.value);setReply(null);setReason('');setError('')}}>{requests.map(r=><option key={r.booking.id} value={r.booking.id}>{r.recipientName} · {date(r.booking.dates[0])} · {r.booking.swapInvitation?.status}</option>)}</select></div>}
    <main className="tp-messages">
     {error&&<div className="tp-error" role="alert">{error}<button type="button" disabled={busy} onClick={()=>void refresh(true)}>Try again</button></div>}
     {loading&&!current?<div className="tp-empty" role="status"><RefreshCw size={25}/><h2>Loading invitations…</h2></div>:!current?<div className="tp-empty"><MessageSquare size={36}/><h2>No shift invitations yet</h2><p>Send a swap invitation from a leave request in the manager view. It will appear here for the colleague to respond.</p><a className="tp-primary-link" href="/#manager-requests">Open leave requests</a></div>:<>
      <div className="tp-day-divider"><span>{invitation?date(invitation.createdAt):'Shift invitation'}</span></div>
      <div className="tp-message"><div className="tp-bot-avatar tp-message-avatar">g!</div><div className="tp-message-body"><div className="tp-message-meta"><strong>GimmeABreak</strong><span>Leave assistant</span></div><article className="tp-card"><div className="tp-card-intro"><span className="tp-card-kicker">SHIFT {option?.kind==='cover'?'COVER':'SWAP'} REQUEST</span><h2>Could you help cover a shift?</h2><p>Hi {current.recipientName}, your manager has sent you a shift invitation.</p></div>
       {invitation?.message&&<p className="tp-invitation-text">{invitation.message}</p>}
       {option&&<div className="tp-shifts"><ShiftBlock shift={option.outgoing} label="You would work" tone="take"/>{option.returnShift?<ShiftBlock shift={option.returnShift} label="Your colleague would work" tone="give"/>:<div className="tp-shift tp-shift-give"><span>Cover arrangement</span><strong>No return shift</strong><small>This adds the requested shift to your roster.</small></div>}</div>}
       <section className="tp-impact"><h3><Clock3 size={17}/> What changes for you</h3><div className="tp-hours"><span>Fortnight hours</span><strong>{number(current.impact.hoursBefore)}h <span>→</span> {number(current.impact.hoursAfter)}h</strong><small>Contracted hours: {number(current.impact.contractHours)}h</small></div><div className="tp-rest"><div><span>Gap since previous duty</span><strong>{rest(current.impact.restBeforeHours)}</strong><small>{current.impact.restBeforeMinimumHours===null?"Minimum needs verification":`${number(current.impact.restBeforeMinimumHours)}h minimum check`}</small></div><div><span>Gap until next duty</span><strong>{rest(current.impact.restAfterHours)}</strong><small>{current.impact.restAfterMinimumHours===null?"Minimum needs verification":`${number(current.impact.restAfterMinimumHours)}h minimum check`}</small></div></div><small className="tp-rest-note">Gaps are measured between recorded duties, including days off. They are not required rest periods; duties missing from the roster are not included.</small></section>
       {option&&<details className="tp-checks"><summary><ShieldCheck size={17}/> Requirements & checks <ChevronDown size={15}/></summary><ul>{option.checks.map(check=><li key={check.id}><span className={`tp-check-dot tp-check-${check.status}`}/><div><strong>{check.label}</strong><p>{check.detail}</p></div></li>)}</ul>{option.unresolved.length>0&&<div className="tp-unresolved"><strong>Manager to verify</strong><ul>{option.unresolved.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}</details>}
       {invitation?.status==='pending'?<div className="tp-response"><p>Your response goes to the manager. Leave still needs their approval.</p>{!reply?<div className="tp-actions"><button className="tp-accept" type="button" disabled={!canReply||busy} onClick={()=>setReply('accepted')}><Check size={17}/> Accept shift</button><button className="tp-decline" type="button" disabled={!canReply||busy} onClick={()=>setReply('declined')}><X size={17}/> Decline</button></div>:<form onSubmit={e=>{e.preventDefault();void sendReply()}}><label htmlFor="tp-reason">{reply==='declined'?'Why can’t you take this shift?':'Add a note for your manager (optional)'}</label><textarea id="tp-reason" maxLength={1000} rows={3} required={reply==='declined'} value={reason} onChange={e=>setReason(e.target.value)} placeholder={reply==='declined'?'e.g. I have a commitment after my existing shift.':'Anything your manager should know…'}/><div className="tp-actions"><button className={reply==='accepted'?'tp-accept':'tp-decline'} type="submit" disabled={busy||!canReply||(reply==='declined'&&!reason.trim())}>{busy?'Sending…':reply==='accepted'?'Confirm acceptance':'Send decline & reason'}</button><button type="button" disabled={busy} onClick={()=>{setReply(null);setReason('')}}>Cancel</button></div></form>}{!canReply&&<small>This invitation is no longer open for a response. Refresh to see its latest status.</small>}</div>:<div className={`tp-response-result tp-result-${invitation?.status}`}><strong>{invitation?.status==='accepted'?<Check size={18}/>:<X size={18}/>} {invitation?.status==='accepted'?'You accepted this shift':'You declined this shift'}</strong>{invitation?.reason&&<p>{invitation.reason}</p>}<small>{invitation?.status==='accepted'?'Your manager can now review the request and approve the leave.':'Your reason has been sent to the manager for their decision and alternative dates.'}</small><a href="/#manager-requests">Continue in manager view →</a></div>}
      </article></div></div>
     </>}
    </main><footer className="tp-conversation-footer"><MessageSquare size={16}/><span>Respond using the invitation buttons above.</span></footer>
   </section>
  </div>
 </div>;
}
