import {describe,it,expect,vi,beforeAll} from 'vitest';
import {executeTool} from '../src/server/chat-tools';
import {completionUrl,runChat} from '../src/server/foundry-chat';
import type {Session} from '../src/server/chat-security';
import {safeMessage} from '../src/server/chat-security';
import {withEmployeeLock} from '../src/server/chat-store';
const s:Session={sid:'test',employeeId:'SYN008078',role:'employee',exp:9999999999};
beforeAll(()=>{process.env.CHAT_LOCAL_STORE=process.cwd()+'/.release-local/test-chat-'+Date.now()+'.json';process.env.CHAT_SESSION_SECRET='a'.repeat(48)});
describe('Foundry server tools',()=>{
 it('reads real full-database balance for server-bound identity',async()=>{const r=await executeTool('get_my_balances',{},s);expect(JSON.stringify(r)).toContain('129.091');await expect(executeTool('get_my_balances',{employeeId:'SYN000001'},s)).rejects.toThrow()});
 it('rejects arbitrary tools and employee department access',async()=>{await expect(executeTool('run_sql',{sql:'SELECT *'},s)).rejects.toThrow();await expect(executeTool('get_department_staffing',{},s)).rejects.toThrow()});
 it('prepares confirmation without submitting',async()=>{const r=await executeTool('prepare_leave_request',{dates:['2026-09-21'],leaveCode:'AL'},s);expect(r.actionProposal?.type).toBe('submit_request');expect((await executeTool('get_my_requests',{},s)).data).toEqual([])});
 it('does not leak infrastructure errors',()=>{expect(safeMessage(new Error('Storage account secret=abcd'))).not.toContain('abcd')});
 it('limits provider endpoints to Azure HTTPS',()=>{expect(()=>completionUrl('http://localhost:8000')).toThrow();expect(completionUrl('https://example.services.ai.azure.com')).toBe('https://example.services.ai.azure.com/openai/v1/chat/completions')});
 it('serializes same-employee state changes',async()=>{const order:number[]=[];await Promise.all([withEmployeeLock('A',async()=>{order.push(1);await new Promise(r=>setTimeout(r,10));order.push(2)}),withEmployeeLock('A',async()=>{order.push(3)})]);expect(order).toEqual([1,2,3])});
 it('executes a real tool call between model messages',async()=>{process.env.FOUNDRY_ENDPOINT='https://example.services.ai.azure.com';process.env.FOUNDRY_API_KEY='test';process.env.FOUNDRY_MODEL='test';const provider=vi.fn().mockResolvedValueOnce(Response.json({choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'1',type:'function',function:{name:'get_my_balances',arguments:'{}'}}]}}]})).mockResolvedValueOnce(Response.json({choices:[{message:{role:'assistant',content:'Your annual leave is129.091hours.'}}]}));const events:unknown[]=[];await runChat([{role:'user',content:'My balances?'}],s,e=>events.push(e),new AbortController().signal,provider);expect(provider).toHaveBeenCalledTimes(2);expect(JSON.stringify(events)).toContain('tool-result');const body=JSON.parse(provider.mock.calls[1][1].body);expect(body.messages.some((m:{role:string;content:string})=>m.role==='tool'&&m.content.includes('129.091'))).toBe(true);delete process.env.FOUNDRY_API_KEY;delete process.env.FOUNDRY_ENDPOINT;delete process.env.FOUNDRY_MODEL});
});
