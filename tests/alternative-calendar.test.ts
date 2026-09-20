import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import AlternativeCalendar,{alternativePrompt,parseAlternativeDates,type AlternativeDates} from '../src/components/chat/AlternativeCalendar';

const data:AlternativeDates={leaveCode:'LS',period:{start:'2026-09-21',end:'2026-10-04'},options:[{dates:['2026-09-22','2026-09-23'],hours:16,affectedShifts:2,noAdditionalCover:true,reason:'Configured floors met on both shifts.',shortfall:0},{dates:['2026-09-24'],hours:8,affectedShifts:1,noAdditionalCover:false,reason:'Requirements not configured.',shortfall:0}],offDuty:{dates:['2026-09-25'],reason:'Rostered off'}};
describe('inline alternative calendar',()=>{
  it('marks verified options green, unverified options amber and off-duty distinctly',()=>{
    const html=renderToStaticMarkup(React.createElement(AlternativeCalendar,{data,onCheck:()=>{}}));
    expect(html.match(/fc-alternative-day clear/g)).toHaveLength(2);
    expect(html.match(/fc-alternative-day review/g)).toHaveLength(1);
    expect(html.match(/fc-alternative-day off/g)).toHaveLength(1);
    expect(html.match(/fc-alternative-day /g)).toHaveLength(14);
    expect(html).toContain('Option: 22 Sept, 23 Sept');
    expect(html).toContain('Rostered off — no leave needed');
  });
  it('checks the exact selected block and correct leave type without submitting',()=>{
    expect(alternativePrompt(data,data.options[0])).toBe('Check LS leave on these exact dates: 2026-09-22, 2026-09-23. Recheck my roster, balance, staffing requirements and policy. Do not submit yet.');
  });
  it('renders no green dates for empty or unverified results',()=>{
    const html=renderToStaticMarkup(React.createElement(AlternativeCalendar,{data:{...data,options:[]},onCheck:()=>{}}));
    expect(html).not.toContain('fc-alternative-day clear');
    expect(html).toContain('No alternative leave dates could be verified');
    expect(parseAlternativeDates({options:[],leaveCode:'AL',period:{start:'bad',end:'bad'}})).toBeUndefined();
    expect(parseAlternativeDates({...data,options:[{...data.options[0],noAdditionalCover:undefined}]} )?.options).toEqual([]);
  });
});
