import {beforeAll,describe,it,expect} from 'vitest';
import {POST as confirm} from '../src/app/api/chat/actions/route';
import {PATCH as decide} from '../src/app/api/chat/requests/route';
import {signValue} from '../src/server/chat-security';
const key='test-session-secret-'.repeat(3);
const employee={sid:'employee-test',employeeId:'SYN008078',role:'employee',exp:9999999999};
function request(url:string,body:unknown,session=employee,method='POST'){return new Request('http://localhost'+url,{method,headers:{'Content-Type':'application/json',Origin:'http://localhost',Cookie:'gimme_session='+signValue(session,key)},body:JSON.stringify(body)})}
const proposal=(nonce:string)=>signValue({kind:'submit_request',sid:employee.sid,employeeId:employee.employeeId,nonce,dates:['2026-09-21'],leaveCode:'AL',note:'',exp:9999999999},key);
beforeAll(()=>{process.env.CHAT_SESSION_SECRET=key;process.env.CHAT_LOCAL_STORE=process.cwd()+'/.release-local/test-actions-'+Date.now()+'.json'});
describe('confirmed request endpoints',()=>{
 it('rejects a changed proposal and cross-origin requests',async()=>{expect((await confirm(request('/api/chat/actions',{proposalId:proposal('tamper')+'x'}))).status).toBe(400);const req=new Request('http://localhost/api/chat/actions',{method:'POST',headers:{Origin:'https://elsewhere.example'},body:'{}'});expect((await confirm(req)).status).toBe(400)});
 it('serializes distinct proposals to prevent duplicate-date submissions',async()=>{const responses=await Promise.all(['first','second'].map(id=>confirm(request('/api/chat/actions',{proposalId:proposal(id)}))));expect(responses.map(r=>r.status).sort()).toEqual([200,400]);const success=await responses.find(r=>r.status===200)!.json();const replay=await confirm(request('/api/chat/actions',{proposalId:proposal(success.request.id)}));expect(replay.status).toBe(200);expect((await replay.json()).message).toContain('already')});
 it('does not allow an employee to approve a request',async()=>{const res=await decide(request('/api/chat/requests',{id:'first',status:'approved',verified:true},employee,'PATCH'));expect(res.status).toBe(403)});
});
