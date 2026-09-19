import {describe,it,expect} from 'vitest';
import {guidanceForAssessment} from '../src/lib/leave-guidance';
import type {Assessment} from '../src/lib/workforce-types';
const base:Assessment={hours:8,shifts:[],balance:null,balanceRemaining:0,checks:[{id:'mix',label:'Staffing',status:'warning',detail:'Census needs verification',source:'Policy'}],reasons:[],canProceed:true,summary:'Needs staffing review'};
describe('leave outcome guidance',()=>{
 it('distinguishes missing verification from a refusal and does not offer unsupported monitoring',()=>{const r=guidanceForAssessment(base,['2026-09-21'],[]);expect(r.status).toBe('review');expect(r.title).not.toMatch(/declin|reject/i);expect(r.actions.some(a=>a.kind==='watch')).toBe(false)});
 it('offers a cosmetic watch only for overlapping booked leave with affected shifts',()=>{const r=guidanceForAssessment({...base,shifts:[{date:'2026-09-21'} as never]},['2026-09-21'],[{date:'2026-09-21',count:2}]);expect(r.actions.find(a=>a.kind==='watch')?.dates).toEqual(['2026-09-21']);expect(r.reasons.join(' ')).toContain('does not establish');expect(r.status).toBe('review')});
 it('does not let staffing suggestions hide a hard balance failure',()=>{const r=guidanceForAssessment({...base,canProceed:false,checks:[{id:'balance',label:'Balance',status:'fail',detail:'Not enough balance',source:'Balances'}]},['2026-09-21'],[]);expect(r.status).toBe('changes');expect(r.reasons[0]).toBe('Not enough balance');expect(r.actions.some(a=>a.id==='prepare')).toBe(false)});
});
