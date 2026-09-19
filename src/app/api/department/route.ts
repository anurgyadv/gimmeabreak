import {getSession} from '@/server/chat-security';
import {getDepartmentInsights} from '@/server/department-insights';
import {listPlanningBookings} from '@/server/chat-store';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){
 const session=getSession(req);if(!session)return Response.json({message:'Unlock the assistant with your manager access code.'},{status:401});
 if(session.role!=='manager')return Response.json({message:'Department leave history requires a manager session.'},{status:403});
 const month=new URL(req.url).searchParams.get('month')||'2026-09';
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))return Response.json({message:'Choose a valid calendar month.'},{status:400});
 try{return Response.json(getDepartmentInsights(month,await listPlanningBookings()),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({message:'Unable to load department leave. Please try again.'},{status:503})}
}
