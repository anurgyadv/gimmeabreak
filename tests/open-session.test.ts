import {afterEach,describe,expect,it,vi} from 'vitest';
import {POST} from '../src/app/api/chat/session/route';
import {getSession,COOKIE,securityConfigured} from '../src/server/chat-security';
afterEach(()=>vi.unstubAllEnvs());
describe('code-free synthetic sessions',()=>{
 it('opens both fixed roles without access codes and keeps HttpOnly cookies',async()=>{
  vi.stubEnv('CHAT_SESSION_SECRET','s'.repeat(48));vi.stubEnv('CHAT_ACCESS_CODE','');vi.stubEnv('MANAGER_ACCESS_CODE','');
  expect(securityConfigured()).toBe(true);
  for(const role of ['employee','manager']){
   const r=await POST(new Request('https://app.example/api/chat/session',{method:'POST',headers:{origin:'https://app.example','Content-Type':'application/json'},body:JSON.stringify({role,employeeId:'OTHER'})}));
   expect(r.status).toBe(200);expect(r.headers.get('set-cookie')).toContain('HttpOnly');
   const cookie=r.headers.get('set-cookie')!.split(';')[0];
   const session=getSession(new Request('https://app.example',{headers:{cookie}}));
   expect(session?.role).toBe(role);expect(session?.employeeId).toBe('SYN008078');
   const again=await POST(new Request('https://app.example/api/chat/session',{method:'POST',headers:{cookie},body:JSON.stringify({role})}));
   expect(getSession(new Request('https://app.example',{headers:{cookie:again.headers.get('set-cookie')!.split(';')[0]}}))?.sid).toBe(session?.sid);
  }
 });
 it('does not issue sessions to cross-origin requests',async()=>{
  vi.stubEnv('CHAT_SESSION_SECRET','s'.repeat(48));
  const r=await POST(new Request('https://app.example/api/chat/session',{method:'POST',headers:{origin:'https://other.example'},body:JSON.stringify({role:'manager'})}));
  expect(r.headers.get('set-cookie')).toBeNull();expect(r.status).toBe(503);
 });
});
