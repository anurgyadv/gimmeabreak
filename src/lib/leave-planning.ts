import type {Balance} from './workforce-types';
export const planningBalance=(b:Balance)=>b.excess&&Number.isFinite(b.remainingHours)&&b.remainingHours>0&&((b.code==='AL'&&b.type==='ANNUAL LEAVE')||(b.code==='LS'&&b.type==='LONG SERVICE LEAVE'));
export const flaggedBalance=(balances:Balance[])=>balances.filter(planningBalance).sort((a,b)=>b.remainingHours-a.remainingHours)[0];
