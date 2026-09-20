import {it,expect} from 'vitest';
import {scriptedLeaveAnswer} from '../src/server/scripted-leave-answer';
import type {Assessment} from '../src/lib/workforce-types';
it('uses current staffing facts and omits generic clinical caveats',()=>{
 const data={canProceed:true,checks:[{id:'balance',status:'pass',detail:'129.09h available · 8h requested'},{id:'mix',status:'warning',detail:'Patient census and competency unverified'}],staffing:[{date:'2026-09-21',band:'Day',role:'Registered Nurse',minimum:11,before:11,after:10,shortfall:1}]} as Parameters<typeof scriptedLeaveAnswer>[0];
 const text=scriptedLeaveAnswer(data);expect(text).toContain('You have enough leave');expect(text).toContain('11 required');expect(text).toContain('10 after your leave');expect(text).not.toMatch(/census|competency|not set/);expect(text.split('\n').filter(s=>s.startsWith('- ')).length).toBeGreaterThan(3);
});
it('does not invent staffing minima or hide balance failures',()=>{
 const text=scriptedLeaveAnswer({canProceed:false,checks:[{id:'balance',status:'fail',detail:'Insufficient leave balance'}],staffing:[{date:'2026-09-21',band:'Day',role:'Registered Nurse',minimum:null,before:11,after:10,shortfall:null}]} as Parameters<typeof scriptedLeaveAnswer>[0]);expect(text).toContain('Insufficient leave balance');expect(text).toContain('not set');expect(text).not.toContain('You have enough leave');
});
