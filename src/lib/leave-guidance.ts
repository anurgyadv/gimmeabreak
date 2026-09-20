import type {Assessment} from './workforce-types';
export type SuggestedAction={id:string;label:string;prompt?:string;kind:'prompt'|'watch';dates?:string[]};
export type BookedAbsenceCount={date:string;count:number};
export function guidanceForAssessment(assessment:Assessment,dates:string[],absences:BookedAbsenceCount[],leaveCode='AL'){
 const failures=assessment.checks.filter(c=>c.status==='fail');
 const booked=absences.filter(a=>a.count>0&&assessment.shifts.some(s=>s.date===a.date));
 const floors=assessment.checks.filter(c=>c.id==='staffing-floor');
 const needsCover=floors.some(c=>c.detail.includes('additional clinician'));
 const balance=assessment.checks.find(c=>c.id==='balance');
 const reasons=failures.map(c=>c.detail);
 if(balance?.status==='pass')reasons.push(`You have enough leave. ${balance.detail}`);
 reasons.push(...floors.map(c=>c.detail));
 if(booked.length)reasons.push(`Other department staff have booked leave on ${booked.map(b=>`${b.date} (${b.count})`).join(', ')}. This needs staffing review; it does not establish that your leave must be refused.`);
 if(!floors.length)reasons.push('Staffing requirements still need to be checked.');
 reasons.push('Your manager makes the final decision.');
 const dateText=dates.join(', '),actions:SuggestedAction[]=[{id:'alternatives',label:'Try different dates',kind:'prompt',prompt:`Find alternative dates for ${leaveCode} leave instead of ${dateText}. Explain the roster impact.`}];
 if(assessment.shifts.length)actions.unshift({id:'swaps',label:'Check a swap or cover',kind:'prompt',prompt:`Check a shift swap or cover for ${leaveCode} leave on ${dateText}. Explain both rosters and remaining checks.`});
 if(assessment.canProceed)actions.push({id:'prepare',label:'Prepare for manager review',kind:'prompt',prompt:`Prepare my ${leaveCode} leave request for ${dateText} for me to confirm. Do not submit automatically.`});
 if(booked.length)actions.push({id:'cancellation-watch-'+booked.map(b=>b.date).join(','),label:'Preview cancellation watch',kind:'watch',dates:booked.map(b=>b.date)});
 return{status:needsCover||!assessment.canProceed?'changes' as const:'review' as const,title:needsCover?'Your leave needs cover':assessment.canProceed?'Ready for manager review':'Your request needs changes',subtitle:needsCover?'Taking leave would leave your shift below its staffing minimum.':assessment.canProceed?'Your manager still needs to approve this request.':'Resolve these blockers before submitting.',reasons,bookedAbsences:booked,actions};
}
