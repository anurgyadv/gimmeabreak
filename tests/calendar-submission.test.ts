import {beforeAll,describe,it,expect} from 'vitest';
import {POST} from '../src/app/api/chat/requests/route';
import {signValue} from '../src/server/chat-security';
const key='calendar-submit-secret-'.repeat(3);
beforeAll(()=>{process.env.CHAT_SESSION_SECRET=key;process.env.CHAT_LOCAL_STORE=process.cwd()+'/.release-local/test-calendar-'+Date.now()+'.json'});
function req(body:unknown,role='employee'){return new Request('http://localhost/api/chat/requests',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json',Cookie:'gimme_session='+signValue({sid:'calendar',employeeId:'SYN008078',role,exp:9999999999},key)},body:JSON.stringify(body)})}
describe('shared calendar submissions',()=>{
 it('reassesses client data and saves the same request used by manager review',async()=>{const body={id:crypto.randomUUID(),dates:['2026-09-21'],leaveCode:'AL',note:'Holiday',assessment:{hours:0,canProceed:true}};const r=await POST(req(body));expect(r.status).toBe(200);const b=await r.json();expect(b.request.assessment.hours).toBe(8);expect(b.request.status).toBe('manager-review');expect((await (await POST(req(body))).json()).request.id).toBe(body.id);expect((await POST(req({...body,id:crypto.randomUUID()}))).status).toBe(400)});
 it('rejects manager impersonation and fabricated swaps',async()=>{const body={id:crypto.randomUUID(),dates:['2026-09-22'],leaveCode:'AL',swapId:'made-up'};expect((await POST(req(body,'manager'))).status).toBe(403);expect((await POST(req(body))).status).toBe(400)});
});
