import {getSession} from '@/server/chat-security';
import {getLeavePlan} from '@/server/department-insights';
import {listPlanningBookings} from '@/server/chat-store';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){
 const session=getSession(req);if(!session)return Response.json({message:'Unlock the assistant with your manager access code.'},{status:401});
 if(session.role!=='manager')return Response.json({message:'Leave planning requires a manager session.'},{status:403});
 const employeeId=new URL(req.url).searchParams.get('employeeId')||'';
 if(!/^SYN\d{6}$/.test(employeeId))return Response.json({message:'Choose a department employee.'},{status:400});
 try{return Response.json(getLeavePlan(employeeId,await listPlanningBookings()),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({message:'No leave plan is available for that department employee.'},{status:400})}
}
