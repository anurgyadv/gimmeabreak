'use client';

import React, {useState} from 'react';
import './alternative-calendar.css';

export type AlternativeOption={dates:string[];hours:number;affectedShifts:number;noAdditionalCover:boolean;reason:string;shortfall:number};
export type AlternativeDates={options:AlternativeOption[];offDuty?:{dates:string[];reason:string};leaveCode:string;period:{start:string;end:string}};
const validDate=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T12:00:00Z`));
export function parseAlternativeDates(value:unknown):AlternativeDates|undefined {
  if(!value||typeof value!=='object')return;
  const data=value as Partial<AlternativeDates>;
  if(!Array.isArray(data.options)||typeof data.leaveCode!=='string'||!data.period||!validDate(data.period.start)||!validDate(data.period.end)||data.period.end<data.period.start)return;
  if((Date.parse(data.period.end)-Date.parse(data.period.start))/86400000>41)return;
  const options=data.options.filter(o=>o&&Array.isArray(o.dates)&&o.dates.length>0&&o.dates.every(d=>validDate(d)&&d>=data.period!.start&&d<=data.period!.end)&&typeof o.noAdditionalCover==='boolean'&&typeof o.reason==='string'&&Number.isFinite(o.hours)&&Number.isFinite(o.affectedShifts));
  const offDuty=data.offDuty&&Array.isArray(data.offDuty.dates)&&typeof data.offDuty.reason==='string'?{dates:data.offDuty.dates.filter(validDate),reason:data.offDuty.reason}:undefined;
  return {options,offDuty,leaveCode:data.leaveCode,period:data.period};
}
const label=(date:string)=>new Date(`${date}T12:00:00Z`).toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'});
export const alternativePrompt=(data:AlternativeDates,option:AlternativeOption)=>`Check ${data.leaveCode} leave on these exact dates: ${option.dates.join(', ')}. Recheck my roster, balance, staffing requirements and policy. Do not submit yet.`;

export default function AlternativeCalendar({data,disabled=false,onCheck}:{data:AlternativeDates;disabled?:boolean;onCheck:(prompt:string)=>void}) {
  const [selected,setSelected]=useState<AlternativeOption|null>(null);
  const days:string[]=[];
  for(let date=new Date(`${data.period.start}T12:00:00Z`);date.toISOString().slice(0,10)<=data.period.end;date.setUTCDate(date.getUTCDate()+1))days.push(date.toISOString().slice(0,10));
  const leading=(new Date(`${data.period.start}T12:00:00Z`).getUTCDay()+6)%7;
  const optionsFor=(day:string)=>data.options.filter(option=>option.dates.includes(day)).sort((a,b)=>Number(b.noAdditionalCover)-Number(a.noAdditionalCover));
  return <section className="fc-alternatives" aria-label="Alternative leave calendar">
    <header><strong>Alternative leave dates</strong><span>{label(data.period.start)} – {label(data.period.end)}</span></header>
    <div className="fc-alternative-grid">
      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=><span className="fc-alternative-weekday" key={day}>{day}</span>)}
      {Array.from({length:leading},(_,i)=><span key={`blank-${i}`}/>)}
      {days.map(day=>{const options=optionsFor(day),option=options[0],offDuty=data.offDuty?.dates.includes(day),tone=option?(option.noAdditionalCover?'clear':'review'):offDuty?'off':'unavailable';return <button type="button" key={day} className={`fc-alternative-day ${tone}${selected?.dates.includes(day)?' selected':''}`} disabled={disabled||!option} aria-pressed={!!selected?.dates.includes(day)} aria-label={`${label(day)}: ${option?`${option.noAdditionalCover?'No additional cover needed':'Needs review'}. Option: ${option.dates.map(label).join(', ')}`:offDuty?'Rostered off — no leave needed':'No suggested leave option'}`} title={option?`Select ${option.dates.map(label).join(', ')}`:offDuty?'Rostered off — no leave needed':'Not suggested'} onClick={()=>setSelected(option)}><b>{Number(day.slice(8))}</b><small>{offDuty&&!option?'Off':day.endsWith('-01')?'Oct':' '}</small></button>})}
    </div>
    <div className="fc-alternative-legend"><span><i className="clear"/>No additional cover</span><span><i className="review"/>Needs review</span><span><i className="off"/>Rostered off</span></div>
    <small className="fc-alternative-note">Green dates meet the configured staffing floors. Manager approval is still required.</small>
    {!data.options.length&&<p>No alternative leave dates could be verified for this fortnight.</p>}
    {selected&&<div className="fc-alternative-selection"><strong>{selected.dates.map(label).join(', ')}</strong><span>{selected.hours}h leave · {selected.affectedShifts} rostered {selected.affectedShifts===1?'shift':'shifts'}</span><p>{selected.reason}</p>{optionsFor(selected.dates[0]).length>1&&<div className="fc-alternative-blocks">{optionsFor(selected.dates[0]).map((option,i)=><button type="button" key={i} disabled={disabled} aria-pressed={option===selected} onClick={()=>setSelected(option)}>{option.dates.map(label).join(', ')}</button>)}</div>}<button type="button" className="fc-primary" disabled={disabled} onClick={()=>onCheck(alternativePrompt(data,selected))}>Check these dates</button></div>}
  </section>;
}
