'use client';

import {useCallback, useEffect, useId, useRef, useState} from 'react';
import {ArrowUp, Check, ChevronDown, Leaf, LoaderCircle, LockKeyhole, MessageCircle, RefreshCw, ShieldCheck, Square, X} from 'lucide-react';
import './foundry-chat.css';

type Status = {configured:boolean; authenticated?:boolean; accessRequired:boolean; role?:'employee'|'manager'|null; model?:string; message?:string};
type Citation = {title:string; url:string};
type Proposal = {id:string; description:string; type:'submit_request'; state?:'confirmed'|'cancelled'; result?:string};
type Activity = {name:string; label:string; summary?:string; complete:boolean};
type ChatAction = {id:string;label:string;prompt?:string;kind?:'prompt'|'watch';dates?:string[]};
type Followup = ChatAction | {id:string;label:string;kind:'dates'};
type Watch = {id:string;dates:string[]};
type Message = {id:string; role:'user'|'assistant'; content:string; activities?:Activity[]; citations?:Citation[]; proposals?:Proposal[]; actions?:ChatAction[]; canProceed?:boolean; requestText?:string};
type StreamEvent = {type:string; name?:string; label?:string; summary?:string; text?:string; message?:string; citations?:Citation[]; actionProposal?:Proposal; actions?:ChatAction[]; data?:{actionProposal?:Proposal;canProceed?:boolean;assessment?:{canProceed?:boolean}}};
const MIN_DATE='2026-09-21',MAX_DATE='2026-10-04';
const validDate=(date:unknown):date is string=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=MIN_DATE&&date<=MAX_DATE;
const dateLabel=(date:string)=>new Date(`${date}T12:00:00`).toLocaleDateString('en-AU',{day:'numeric',month:'short'});
function mergeActions(previous:ChatAction[]=[],incoming:ChatAction[]=[]){return [...new Map([...previous,...incoming.filter(a=>a&&typeof a.id==='string'&&typeof a.label==='string'&&((a.kind==='watch'&&a.dates?.length&&a.dates.every(validDate))||(a.kind!=='watch'&&typeof a.prompt==='string'&&a.prompt.trim())))].map(a=>[a.id,a])).values()];}
function followups(message:Message,manager:boolean):Followup[]{
  const actions:Followup[]=[...(message.actions||[])];
  const names=message.activities?.filter(a=>a.complete).map(a=>a.name)||[];
  if(!actions.length){
    if(manager){actions.push({id:'staffing',label:'Department planning',prompt:'Use the department staffing tool to summarise the connected fortnight for leave planning. Explain its limits.'},{id:'fairness',label:'Fairness guidance',prompt:'Find the relevant leave policy and explain fair review considerations. Distinguish guidance from verified department data.'});}
    else if(names.includes('check_leave')||names.includes('find_shift_options')){
      actions.push({id:'swaps',label:'Find shift swaps',prompt:`Find shift options for the same leave dates and type discussed in this request: ${message.requestText||'my last request'}. Ask me to choose dates if they are unclear.`},{id:'alternatives',label:'Alternative dates',prompt:'Use my roster and leave checks to compare alternative dates within 21 September–4 October 2026 for the leave type we discussed. Explain which dates still need manager review.'});
      if(message.canProceed===true&&!message.proposals?.length)actions.push({id:'review',label:'Send for review',prompt:'Prepare the leave request we just checked for manager review. Show me the confirmation card before submitting.'});
    } else if(names.includes('get_my_balances'))actions.push({id:'roster',label:'See my roster',prompt:'Show my next fortnight of shifts.'});
    else if(names.includes('get_my_roster'))actions.push({id:'balances',label:'Check balances',prompt:'What are my leave balances?'});
    else actions.push({id:'balances',label:'My balances',prompt:'What are my leave balances?'},{id:'roster',label:'My roster',prompt:'Show my next fortnight of shifts.'});
  }
  actions.push({id:'choose-dates',label:manager?'Choose leave dates':'Check leave dates',kind:'dates'});
  return actions;
}
const prompts = ['What are my leave balances?', 'Show my next fortnight of shifts', 'Can I take leave on 21 September?', 'What shift swaps could work for me?'];
const managerPrompts = ['Which employees need a leave management plan?', 'Show Sarah Chen’s leave history by type and year', 'Suggest lower-impact leave dates for Sarah Chen'];
const safeUrl = (value:string) => {try {const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null;} catch {return null;}};
async function failure(response:Response, fallback:string) {try {const body = await response.json(); return typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : fallback;} catch {return fallback;}}

export default function FoundryChat({manager=false}:{manager?:boolean}) {
  const [open,setOpen] = useState(false), [status,setStatus] = useState<Status|null>(null), [checking,setChecking] = useState(false);
  const [messages,setMessages] = useState<Message[]>([]), [input,setInput] = useState(''), [accessCode,setAccessCode] = useState('');
  const [busy,setBusy] = useState(false), [signingIn,setSigningIn] = useState(false), [error,setError] = useState(''), [confirming,setConfirming] = useState<string|null>(null);
  const [employee,setEmployee] = useState<{name:string;role:string}|null>(null);
  const [datesOpen,setDatesOpen]=useState(false),[startDate,setStartDate]=useState(MIN_DATE),[endDate,setEndDate]=useState(MIN_DATE),[leaveCode,setLeaveCode]=useState('AL');
  const [watches,setWatches]=useState<Watch[]>([]);
  const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLElement>(null), composer = useRef<HTMLTextAreaElement>(null), scroll = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController|null>(null), accessRequest = useRef<AbortController|null>(null), actionRequest = useRef<AbortController|null>(null), statusRequest = useRef<AbortController|null>(null), sending = useRef(false);
  const headingId=useId(), codeId=useId(), inputId=useId();
  const role=manager?'manager':'employee';
  const watchKey=`gimme:watch-preview:${role}:SYN008078`;
  const locked = !!status && ((status.accessRequired&&!status.authenticated)||status.role!==role);
  const ready = !!status?.configured && !locked;
  const refresh = useCallback(async () => {
    statusRequest.current?.abort(); const control=new AbortController(); statusRequest.current=control;
    setChecking(true); setError('');
    try {const result=await fetch('/api/chat/status',{credentials:'same-origin',cache:'no-store',signal:control.signal}); if(!result.ok)throw new Error(await failure(result,'Unable to check the assistant connection.')); const body=await result.json(); if(typeof body.configured!=='boolean')throw new Error('The assistant returned an invalid connection status.'); setStatus(body);}
    catch(e) {if(!control.signal.aborted){setStatus(null);setError(e instanceof Error?e.message:'Unable to connect.');}}
    finally {if(!control.signal.aborted)setChecking(false);}
  },[]);
  const close=useCallback(()=>{request.current?.abort(); accessRequest.current?.abort(); actionRequest.current?.abort();statusRequest.current?.abort();setConfirming(null); setAccessCode('');window.dispatchEvent(new CustomEvent('gimme:server-request')); setSigningIn(false); setChecking(false); setOpen(false); trigger.current?.focus();},[]);
  useEffect(()=>{
    const openChat=(event:Event)=>{const prompt=(event as CustomEvent<{prompt?:string}>).detail?.prompt;setOpen(true);if(typeof prompt==='string')setInput(prompt.slice(0,4000));};
    window.addEventListener('gimme:open-chat',openChat);return()=>window.removeEventListener('gimme:open-chat',openChat);
  },[]);
  useEffect(()=>{try{const saved:unknown=JSON.parse(localStorage.getItem(watchKey)||'[]');setWatches(Array.isArray(saved)?saved.filter((w):w is Watch=>!!w&&typeof w.id==='string'&&Array.isArray(w.dates)&&w.dates.length>0&&w.dates.every(validDate)).map(({id,dates})=>({id,dates})):[]);}catch{setWatches([]);}},[watchKey]);
  function saveWatches(next:Watch[]){setWatches(next);try{localStorage.setItem(watchKey,JSON.stringify(next.map(({id,dates})=>({id,dates}))));}catch{setError('This preview could not be saved on this device.');}}
  function chooseAction(action:Followup){if(action.kind==='dates'){setDatesOpen(true);return;}if(action.kind==='watch'){if(action.dates?.length&&action.dates.every(validDate))saveWatches([...watches.filter(w=>w.id!==action.id),{id:action.id,dates:action.dates}]);return;}if(action.prompt)void send(action.prompt);}
  function checkDates(e:React.FormEvent){e.preventDefault();if(!validDate(startDate)||!validDate(endDate)||endDate<startDate)return;setDatesOpen(false);void send(`Check ${leaveCode} leave from ${startDate} through ${endDate}, inclusive, against my roster, balances and policy. Explain any staffing concerns and next steps. Do not submit yet.`);}
  useEffect(()=>{request.current?.abort();accessRequest.current?.abort();setMessages([]);setInput('');setAccessCode('');window.dispatchEvent(new CustomEvent('gimme:server-request'));setEmployee(null);setError('');},[manager]);
  useEffect(()=>()=>{request.current?.abort();accessRequest.current?.abort();actionRequest.current?.abort();statusRequest.current?.abort();},[]);
  useEffect(()=>{
    if(!open)return;
    void refresh(); panel.current?.focus();
    const previousOverflow=document.body.style.overflow; document.body.style.overflow='hidden';
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){e.preventDefault();close();}
      if(e.key!=='Tab')return;
      const nodes=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')||[]).filter(node=>node.getClientRects().length>0);
      if(!nodes?.length){e.preventDefault();return;}
      const first=nodes[0],last=nodes[nodes.length-1];
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=previousOverflow;};
  },[open,refresh,close]);
  useEffect(()=>{if(scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;},[messages,busy,error]);
  const update=(id:string,change:(message:Message)=>Message)=>setMessages(previous=>previous.map(m=>m.id===id?change(m):m));
  async function signIn(e:React.FormEvent) {
    e.preventDefault();if(!accessCode.trim()||signingIn)return;
    const control=new AbortController();accessRequest.current=control;setSigningIn(true);setError('');
    try {const result=await fetch('/api/chat/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessCode:accessCode.trim(),role}),signal:control.signal}); if(!result.ok)throw new Error(await failure(result,'That access code was not accepted.')); const body=await result.json();if(!body.ok)throw new Error(body.message||'Unable to start your session.');setEmployee(body.employee||null);setStatus(s=>s?{...s,authenticated:true,role}:s);setAccessCode('');window.dispatchEvent(new CustomEvent('gimme:server-request'));setTimeout(()=>composer.current?.focus(),0);}
    catch(e){if(!control.signal.aborted)setError(e instanceof Error?e.message:'Unable to start your session.');}
    finally{if(!control.signal.aborted)setSigningIn(false);}
  }
  async function send(text=input) {
    const content=text.trim();if(!content||!ready||sending.current||confirming)return;
    sending.current=true;setBusy(true);setError('');setInput('');
    const user:Message={id:crypto.randomUUID(),role:'user',content};const answerId=crypto.randomUUID();
    const history=[...messages.filter(m=>m.content).map(({role,content})=>({role,content})),{role:'user' as const,content}].slice(-12);
    setMessages(previous=>[...previous,user,{id:answerId,role:'assistant',content:'',activities:[],requestText:content}]);
    const control=new AbortController();request.current=control;let completed=false,failed=false;
    function consume(line:string) {
      if(!line.trim())return;
      const item=JSON.parse(line) as StreamEvent;
      if(item.type==='tool-start')update(answerId,m=>({...m,activities:[...(m.activities||[]),{name:item.name||'tool',label:item.label||'Checking your records',complete:false}]}));
      if(item.type==='tool-result')update(answerId,m=>{
        const activities=[...(m.activities||[])];const index=activities.findIndex(a=>a.name===item.name&&!a.complete);
        const result={name:item.name||'tool',label:item.label||activities[index]?.label||'Records checked',summary:item.summary,complete:true};
        if(index>=0)activities[index]=result;else activities.push(result);
        const candidate=item.actionProposal||item.data?.actionProposal;
        const proposal=candidate?.type==='submit_request'&&typeof candidate.id==='string'&&typeof candidate.description==='string'?candidate:null;
        return {...m,activities,actions:mergeActions(m.actions,item.actions),canProceed:item.data?.assessment?.canProceed??item.data?.canProceed??m.canProceed,proposals:proposal?[...(m.proposals||[]).filter(p=>p.id!==proposal.id),proposal]:m.proposals};
      });
      if(item.type==='answer')update(answerId,m=>({...m,content:m.content+(item.text||''),citations:item.citations||m.citations,actions:mergeActions(m.actions,item.actions)}));
      if(item.type==='error'){failed=true;setError(item.message||'The assistant could not complete this request.');}
      if(item.type==='done')completed=true;
    }
    try {
      const result=await fetch('/api/chat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history,requestId:crypto.randomUUID(),role}),signal:control.signal});
      if(result.status===401){setStatus(s=>s?{...s,authenticated:false,accessRequired:true}:s);throw new Error('Your session has expired. Enter your access code to continue.');}
      if(!result.ok)throw new Error(await failure(result,'The assistant is temporarily unavailable.'));
      if(!result.body)throw new Error('The assistant returned no response.');
      const reader=result.body.getReader(),decoder=new TextDecoder();let buffer='';
      while(true){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()||'';for(const line of lines)consume(line);}
      buffer+=decoder.decode();if(buffer.trim())consume(buffer);
      if(!completed&&!failed)throw new Error('The response was interrupted. Please try again.');
    } catch(e){if(control.signal.aborted)update(answerId,m=>({...m,content:m.content||'Response stopped.'}));else setError(e instanceof Error?e.message:'Something went wrong. Please try again.');}
    finally{sending.current=false;setBusy(false);request.current=null;}
  }
  async function confirm(messageId:string,proposal:Proposal) {
    if(confirming||busy||proposal.state)return;setConfirming(proposal.id);setError('');
    const control=new AbortController();actionRequest.current=control;
    try {const result=await fetch('/api/chat/actions',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({proposalId:proposal.id,role}),signal:control.signal});if(!result.ok)throw new Error(await failure(result,'Unable to confirm the request.'));const body=await result.json();if(!body.ok)throw new Error(body.message||'The request was not submitted.');update(messageId,m=>({...m,proposals:m.proposals?.map(p=>p.id===proposal.id?{...p,state:'confirmed',result:body.message||'Request submitted for review.'}:p)}));window.dispatchEvent(new CustomEvent('gimme:server-request'));}
    catch(e){if(!control.signal.aborted)setError(e instanceof Error?e.message:'Unable to confirm.');}
    finally{if(!control.signal.aborted)setConfirming(null);}
  }
  return <div className="fc-root">
    <button className="fc-launch" ref={trigger} onClick={()=>setOpen(true)} aria-haspopup="dialog" aria-expanded={open}><MessageCircle size={21}/><span>Chat with GimmeABreak</span></button>
    {open&&<div className="fc-overlay" onClick={e=>{if(e.target===e.currentTarget)close();}}>
      <section className="fc-panel" ref={panel} role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1}>
        <header className="fc-header"><span className="fc-mark"><Leaf size={25}/></span><div><h2 id={headingId}>{manager?'A little help for your team':'A little help with your leave'}</h2><p>Your leave assistant</p></div><button className="fc-icon" onClick={close} aria-label="Close chat"><X size={21}/></button></header>
        <div className="fc-connection"><span className={ready?'connected':''}/><small>{checking?'Checking connection…':!status?'Connection unavailable':!status.configured?'Model not connected':locked?'Sign in to access your records':employee?`${employee.name} · ${employee.role}`:'Connected to your leave assistant'}</small>{!busy&&<button className="fc-icon" onClick={()=>void refresh()} disabled={checking} aria-label="Refresh connection"><RefreshCw size={14} className={checking?'fc-spin':''}/></button>}</div>
        <div className="fc-body" ref={scroll}>
          {!messages.length&&<div className="fc-welcome"><div className="fc-welcome-art"><Leaf size={34}/></div><h3>Let’s make room for a break.</h3><p>{manager?<>Ask about your department’s roster,<br/>leave requests and policy checks.</>:<>Ask about your balances, your roster,<br/>or the dates you have in mind.</>}</p></div>}
          {status&&!status.configured&&<div className="fc-notice"><ShieldCheck size={20}/><div><strong>Your AI assistant isn’t connected yet</strong><p>{status.message||'Connect the Azure model to start chatting with your records.'}</p></div></div>}
          {locked&&status?.configured&&<form className="fc-access" onSubmit={signIn}><LockKeyhole size={21}/><h3>Open your secure session</h3><p>{manager?'Use your manager access code to review your department.':'Use your employee access code to chat with your own records.'}</p><label htmlFor={codeId}>{manager?'Manager':'Employee'} access code</label><input id={codeId} type="password" value={accessCode} onChange={e=>setAccessCode(e.target.value)} autoComplete="off" maxLength={256} required disabled={signingIn}/><button className="fc-primary" disabled={signingIn||!accessCode.trim()}>{signingIn?<><LoaderCircle className="fc-spin" size={17}/>Connecting…</>:'Continue securely'}</button></form>}
          {!messages.length&&ready&&<div className="fc-prompts">{(manager?managerPrompts:prompts).map(prompt=><button key={prompt} onClick={()=>void send(prompt)} disabled={busy}>{prompt}<ArrowUp size={15}/></button>)}</div>}
          <div className="fc-messages" role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions text">
            {messages.map(message=><article key={message.id} className={`fc-message ${message.role}`}><span className="fc-author">{message.role==='user'?'You':'GimmeABreak'}</span>
              {!!message.activities?.length&&<details className="fc-activity"><summary><ShieldCheck size={15}/>{message.activities.filter(a=>a.complete).length} of {message.activities.length} checks complete<ChevronDown size={14}/></summary>{message.activities.map((activity,i)=><div key={`${activity.name}-${i}`}>{activity.complete?<Check size={15}/>:busy?<LoaderCircle className="fc-spin" size={15}/>:<Square size={13}/>}<span><strong>{activity.label}</strong>{activity.summary&&<small>{activity.summary}</small>}</span></div>)}</details>}
              {message.content&&<p className="fc-text">{message.content}</p>}
              {message.role==='assistant'&&!message.content&&busy&&message.id===messages.at(-1)?.id&&<p className="fc-working"><LoaderCircle className="fc-spin" size={15}/>{message.activities?.filter(a=>!a.complete).at(-1)?.label||'Working on your question…'}</p>}
              {!!message.citations?.length&&<div className="fc-sources">{message.citations.map((citation,i)=>{const href=safeUrl(citation.url);return href?<a key={`${href}-${i}`} href={href} target="_blank" rel="noopener noreferrer">{citation.title} ↗</a>:null;})}</div>}
              {message.proposals?.map(proposal=><div className="fc-proposal" key={proposal.id}><strong>{proposal.state==='confirmed'?'Request submitted':proposal.state==='cancelled'?'Not submitted':'Ready for your confirmation'}</strong><p>{proposal.result||proposal.description}</p>{!proposal.state&&<><small>This will submit the request for review.</small><div><button className="fc-primary" disabled={!!confirming||busy} onClick={()=>void confirm(message.id,proposal)}>{confirming===proposal.id?'Submitting…':'Confirm submission'}</button><button className="fc-secondary" disabled={!!confirming||busy} onClick={()=>update(message.id,m=>({...m,proposals:m.proposals?.map(p=>p.id===proposal.id?{...p,state:'cancelled'}:p)}))}>Not now</button></div></>}</div>)}
              {message.role==='assistant'&&message.content&&!(busy&&message.id===messages.at(-1)?.id)&&<div className="fc-followups" aria-label="Suggested next steps">{followups(message,manager).map(action=><button key={action.id} disabled={!ready||busy||!!confirming} onClick={()=>chooseAction(action)}>{action.label}<ArrowUp size={12}/></button>)}</div>}
            </article>)}
          </div>
          {ready&&watches.map(watch=><section className="fc-watch" key={watch.id} aria-label="Cancellation watch preview"><div><strong>Cancellation watch</strong><button className="fc-icon" aria-label="Remove cancellation watch preview" onClick={()=>saveWatches(watches.filter(w=>w.id!==watch.id))}><X size={15}/></button></div><p>{watch.dates.map(dateLabel).join(', ')}</p><small>Preview — monitoring is not active. No notifications will be sent.</small></section>)}
          {error&&<div className="fc-error" role="alert">{error}</div>}
        </div>
        <footer className="fc-footer">
          {ready&&<>
            <div className="fc-shortcuts"><button className="fc-secondary" disabled={busy||!!confirming} onClick={()=>setDatesOpen(value=>!value)} aria-expanded={datesOpen}>Choose dates</button><details className="fc-menu"><summary>More actions <ChevronDown size={13}/></summary><div>{[
              {label:'My balances',prompt:'What are my leave balances?'},
              {label:'My roster',prompt:'Show my next fortnight of shifts.'},
              {label:'Find shift swaps',prompt:'Find shift swaps for the leave dates and type we discussed. If we have not selected dates yet, ask me to choose them.'},
              {label:'Alternative dates',prompt:'Suggest alternative leave dates in 21 September–4 October 2026 using my roster and leave checks. Ask for my leave type if needed.'},
              {label:'Send for review',prompt:'Prepare my discussed leave request for manager review. If dates or leave type are missing, ask me to choose them. Show a confirmation card before submitting.'},
              ...(manager?[{label:'Department planning',prompt:'Use department staffing records to summarise the connected fortnight for leave planning, stating the data limitations.'},{label:'Fairness guidance',prompt:'Find relevant leave policy and explain fair review considerations, separating guidance from verified staffing data.'}]:[])
            ].map(action=><button key={action.label} disabled={busy||!!confirming} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');void send(action.prompt);}}>{action.label}</button>)}</div></details></div>
            {datesOpen&&<form className="fc-dates" onSubmit={checkDates}><div className="fc-date-heading"><strong>Check your leave dates</strong><button type="button" className="fc-icon" aria-label="Close date picker" onClick={()=>setDatesOpen(false)}><X size={15}/></button></div><div className="fc-date-fields"><label>From<input type="date" min={MIN_DATE} max={MAX_DATE} value={startDate} onChange={e=>{setStartDate(e.target.value);if(e.target.value>endDate)setEndDate(e.target.value);}} required disabled={busy||!!confirming}/></label><label>Through<input type="date" min={startDate||MIN_DATE} max={MAX_DATE} value={endDate} onChange={e=>setEndDate(e.target.value)} required disabled={busy||!!confirming}/></label></div><label>Leave type<select value={leaveCode} onChange={e=>setLeaveCode(e.target.value)} disabled={busy||!!confirming}><option value="AL">Annual leave (AL)</option><option value="PE">Personal leave (PE)</option><option value="LS">Long service leave (LS)</option></select></label><div className="fc-date-submit"><small>21 Sep–4 Oct 2026 · Includes both dates</small><button className="fc-primary" disabled={busy||!!confirming||!validDate(startDate)||!validDate(endDate)||endDate<startDate}>Check leave</button></div></form>}
          </>}
          <form onSubmit={e=>{e.preventDefault();void send();}} className="fc-compose"><label className="fc-sr" htmlFor={inputId}>Message GimmeABreak</label><textarea id={inputId} ref={composer} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}} placeholder={ready?'Ask a question or choose an action…':'Your assistant will be ready here'} maxLength={4000} rows={2} disabled={!ready||busy||!!confirming}/>{busy?<button type="button" className="fc-send fc-stop" onClick={()=>request.current?.abort()} aria-label="Stop response"><Square size={16}/></button>:<button type="submit" className="fc-send" disabled={!ready||!input.trim()||!!confirming} aria-label="Send message"><ArrowUp size={21}/></button>}</form><small>AI can make mistakes. Your manager approves leave.</small></footer>
      </section>
    </div>}
  </div>;
}
