import {beforeAll,describe,it,expect} from 'vitest';
import {listInvitations,saveInvitation} from '../src/server/chat-store';
import type {LeaveInvitation} from '../src/lib/leave-invitation';
beforeAll(()=>{process.env.CHAT_LOCAL_STORE=process.cwd()+'/.release-local/test-invitations-'+Date.now()+'.json'});
describe('employee leave-plan inbox',()=>{
 it('persists invitations only in the addressed employee inbox',async()=>{
  const message:LeaveInvitation={id:'inv-1',employeeId:'SYN008078',employeeName:'Sarah Chen',leaveCode:'LS',message:'Let’s agree a leave plan.',dates:['2026-09-21'],hours:8,balanceHours:592,remainingHours:584,status:'invited',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),sender:'Clinical Nurse Manager',reason:'Source excess flag',policyUrl:'https://www.health.wa.gov.au/',staffingNote:'Manager verification required'};
  await saveInvitation(message);expect(await listInvitations('SYN000001')).toEqual([]);expect((await listInvitations('SYN008078'))[0].message).toBe(message.message);
  await saveInvitation({...message,status:'discuss'});expect((await listInvitations('SYN008078'))[0].status).toBe('discuss');
 });
});
