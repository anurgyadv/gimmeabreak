import type {Assessment} from '../lib/workforce-types';
import type {StaffingImpact} from './staffing-plan';
export function scriptedLeaveAnswer(data:Assessment & {staffing:StaffingImpact[]}){
 const balance=data.checks.find(c=>c.id==='balance');
 const failed=data.checks.filter(c=>c.status==='fail'&&c.id!=='balance');
 const shortages=data.staffing.filter(s=>(s.shortfall??0)>0);
 const missing=data.staffing.filter(s=>s.minimum===null);
 const lines=[shortages.length?'**Your leave needs cover.**':!data.canProceed?'**Your request needs an update.**':'**Your leave is ready for manager review.**','', '**Why**'];
 if(balance)lines.push(`- ${balance.status==='pass'?'**You have enough leave.** ':''}${balance.detail}`);
 for(const check of failed)lines.push(`- ${check.detail}`);
 for(const s of shortages)lines.push(`- **${s.date} · ${s.band} · ${s.role}: ${s.minimum} required.** ${s.before} rostered → **${s.after} after your leave**. Short by **${s.shortfall}**.`);
 if(missing.length)lines.push('- Some shift requirements are not set. Your manager needs to set those minimums before coverage can be checked.');
 else if(data.staffing.length&&!shortages.length)lines.push('- Your leave maintains the configured staffing minimums. No additional cover is needed.');
 lines.push('- Your manager makes the final decision.','','**Options**',shortages.length?'- Check a swap or cover.':!data.canProceed?'- Update the request to resolve the failed checks.':'- Prepare the request for manager review.','- Show alternative dates.');
 return lines.join('\n');
}
