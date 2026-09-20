import {beforeEach,describe,it,expect} from 'vitest';
import {DELETE,GET} from '../src/app/api/chat/requests/route';
import {listBookings,listPlanningBookings,saveBooking} from '../src/server/chat-store';
import {signValue} from '../src/server/chat-security';
import {assess} from '../src/lib/workforce-engine';
import raw from '../src/data/workforce.json';
import pol from '../src/data/policies.json';
import type {Booking,Workforce,PolicyIndex} from '../src/lib/workforce-types';
const key='delete-test-key'.repeat(4);
const session={sid:'delete-test',employeeId:'SYN008078',role:'employee',exp:9999999999};
function req(id='delete-me',method='DELETE'){return new Request('http://localhost/api/chat/requests',{method,headers:{Origin:'http://localhost','Content-Type':'application/json',Cookie:'gimme_session='+signValue(session,key)},...(method==='DELETE'?{body:JSON.stringify({id})}:{})})}
let booking:Booking;
beforeEach(async()=>{process.env.CHAT_SESSION_SECRET=key;process.env.CHAT_LOCAL_STORE=process.cwd()+'/.release-local/test-delete-'+crypto.randomUUID()+'.json';delete process.env.AZURE_STORAGE_CONNECTION_STRING;booking={id:'delete-me',employeeId:session.employeeId,leaveCode:'AL',leaveType:'Annual leave',dates:['2026-09-21'],note:'',assessment:assess(raw as Workforce,pol as unknown as PolicyIndex,['2026-09-21'],'AL'),status:'approved',swap:null,message:'',managerNote:'',createdAt:'2026-09-20',events:[]};await saveBooking(booking)});
describe('recoverable request deletion',()=>{
 it('removes active and planning records while preserving a tombstone for refresh and recovery',async()=>{expect((await DELETE(req())).status).toBe(200);expect(await listBookings(session.employeeId)).toEqual([]);expect(await listPlanningBookings()).toEqual([]);const saved=(await listBookings(session.employeeId,true))[0];expect(saved.deletedAt).toBeTruthy();expect(saved.status).toBe('approved');const response=await (await GET(req('', 'GET'))).json();expect(response.deletedIds).toEqual(['delete-me']);expect(response.requests).toEqual([]);expect((await DELETE(req())).status).toBe(200)});
 it('rejects unauthenticated, cross-origin and other employee requests',async()=>{expect((await DELETE(new Request('http://localhost/api/chat/requests',{method:'DELETE',body:JSON.stringify({id:'delete-me'})}))).status).toBe(400);const cross=req();cross.headers.set('Origin','https://elsewhere.example');expect((await DELETE(cross)).status).toBe(400);await saveBooking({...booking,id:'someone-else',employeeId:'SYN000001'});expect((await DELETE(req('someone-else'))).status).toBe(400);expect((await listBookings(session.employeeId)).length).toBe(1)});
 it('does not resurrect a deleted request when its old submission is replayed',async()=>{await DELETE(req());await expect(saveBooking(booking,true)).rejects.toThrow('deleted');expect(await listBookings(session.employeeId)).toEqual([])});
});
