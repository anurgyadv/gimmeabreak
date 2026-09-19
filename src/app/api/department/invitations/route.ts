import {getSession,sameOrigin,readBody} from '@/server/chat-security';
import {getLeavePlan} from '@/server/department-insights';
import {listPlanningBookings,listInvitations,saveInvitation,audit,withEmployeeLock} from '@/server/chat-store';
import type {LeaveInvitation} from '@/lib/leave-invitation';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){
 const s=getSession(req);if(!s)return Response.json({message:'Unlock the assistant to read messages.'},{status:401});
 const target=new URL(req.url).searchParams.get('employeeId')||s.employeeId;
 if(target!==s.employeeId&&s.role!=='manager')return Response.json({message:'You can only read your own messages.'},{status:403});
 try{if(s.role==='manager')getLeavePlan(target,[]);return Response.json({invitations:await listInvitations(target)},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({message:'Unable to load these messages.'},{status:400})}
}
export async function POST(req:Request){
 const s=getSession(req);if(!s)return Response.json({message:'Unlock the assistant with your manager access code.'},{status:401});
 if(s.role!=='manager')return Response.json({message:'Only a manager can send a leave-plan invitation.'},{status:403});
 try{sameOrigin(req);const b=await readBody(req,5000);
  if(typeof b.employeeId!=='string'||!/^SYN\d{6}$/.test(b.employeeId)||typeof b.message!=='string'||!b.message.trim()||b.message.length>1200||!Array.isArray(b.dates))throw new Error('Invalid invitation.');
  return await withEmployeeLock(b.employeeId,async()=>{
   const plan=getLeavePlan(b.employeeId,await listPlanningBookings());
   if(!plan.eligible||b.leaveCode!==plan.leaveCode)throw new Error('This employee needs a different leave plan.');
   const dates=[...new Set(b.dates)].sort();const option=plan.suggestions.find(o=>JSON.stringify(o.dates)===JSON.stringify(dates));
   if(dates.length&&!option)throw new Error('Suggested dates changed. Refresh the leave plan.');
   const previous=(await listInvitations(b.employeeId)).find(i=>i.status==='invited'&&i.leaveCode===plan.leaveCode&&JSON.stringify(i.dates)===JSON.stringify(dates));
   if(previous)return Response.json({ok:true,invitation:previous,message:'This invitation is already in the employee inbox.'});
   const at=new Date().toISOString();const invitation:LeaveInvitation={id:crypto.randomUUID(),employeeId:b.employeeId,employeeName:plan.name,leaveCode:plan.leaveCode,message:b.message.trim(),dates:option?.dates||[],hours:option?.hours||0,balanceHours:plan.balanceHours,remainingHours:option?.remainingHours??plan.balanceHours,status:'invited',createdAt:at,updatedAt:at,sender:'Clinical Nurse Manager',reason:plan.reason,policyUrl:plan.policyUrl,staffingNote:option?.reason||'Discuss timing with the employee before selecting dates.'};
   await saveInvitation(invitation);await audit(b.employeeId,'leave-plan-invitation',{id:invitation.id,dates:invitation.dates,senderRole:s.role});
   return Response.json({ok:true,invitation,message:'Sent to the employee’s in-app inbox. No email or Teams message was sent.'});
  });
 }catch{return Response.json({message:'The invitation could not be sent. Refresh the plan and choose a current suggestion, or send an invitation without dates.'},{status:400})}
}
export async function PATCH(req:Request){
 const s=getSession(req);if(!s)return Response.json({message:'Unlock the assistant to reply.'},{status:401});
 if(s.role!=='employee')return Response.json({message:'Switch to your employee session to reply.'},{status:403});
 try{sameOrigin(req);const b=await readBody(req,1500);if(!['interested','discuss'].includes(b.status)||typeof b.id!=='string')throw new Error('Invalid response');
  return await withEmployeeLock(s.employeeId,async()=>{const invitation=(await listInvitations(s.employeeId)).find(i=>i.id===b.id);if(!invitation)throw new Error('Not found');const updated:LeaveInvitation={...invitation,status:b.status,updatedAt:new Date().toISOString()};await saveInvitation(updated);await audit(s.employeeId,'leave-plan-response',{id:b.id,status:b.status});return Response.json({ok:true,invitation:updated})});
 }catch{return Response.json({message:'Unable to save your response.'},{status:400})}
}
