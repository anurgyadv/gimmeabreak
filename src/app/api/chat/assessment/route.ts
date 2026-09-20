import {requireSession,sameOrigin,readBody,validateLeaveInput,safeMessage} from '@/server/chat-security';
import {listBookings} from '@/server/chat-store';
import {assessWithGuidance} from '@/server/leave-guidance';
export const runtime='nodejs';
export async function POST(req:Request){try{sameOrigin(req);const session=requireSession(req),body=await readBody(req,3000);const input=validateLeaveInput({dates:body.dates,leaveCode:body.leaveCode});const requests=(await listBookings(session.employeeId)).filter(r=>r.id!==body.requestId);return Response.json(await assessWithGuidance(input.dates,input.leaveCode,requests),{headers:{'Cache-Control':'no-store'}})}catch(e){return Response.json({message:safeMessage(e)},{status:400})}}
