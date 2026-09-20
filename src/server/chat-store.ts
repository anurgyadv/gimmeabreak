import {TableClient} from '@azure/data-tables';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import type {Booking} from '../lib/workforce-types';
import type {LeaveInvitation} from '../lib/leave-invitation';
let initialized:Promise<TableClient>|undefined;
export function storageConfigured(){return Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING)||process.env.NODE_ENV!=='production'}
async function table(){if(!process.env.AZURE_STORAGE_CONNECTION_STRING)return null;if(!initialized)initialized=(async()=>{const t=TableClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING!,'GimmeWorkforce');await t.createTable().catch(e=>{if(e.statusCode!==409)throw e});return t})().catch(e=>{initialized=undefined;throw e});return initialized}
const localFile=()=>process.env.CHAT_LOCAL_STORE||path.join(process.cwd(),'.release-local','walkthrough-state-20260920.json');
let localQueue=Promise.resolve();
type State={bookings:Booking[];audit:unknown[];usage:Record<string,number>;invitations?:LeaveInvitation[]};
async function local<T>(fn:(s:State)=>T|Promise<T>):Promise<T>{if(process.env.NODE_ENV==='production')throw new Error('Persistent storage is not connected.');let result:T;const next=localQueue.then(async()=>{let state:State;try{state=JSON.parse(await readFile(/* turbopackIgnore: true */ localFile(),'utf8'))}catch{state={bookings:[],audit:[],usage:{}}}result=await fn(state);await mkdir(path.dirname(localFile()),{recursive:true});await writeFile(localFile(),JSON.stringify(state))});localQueue=next.catch(()=>{});await next;return result!}
export async function listBookings(employeeId:string):Promise<Booking[]>{const t=await table();if(!t)return local(s=>s.bookings.filter(b=>b.employeeId===employeeId));const records:Booking[]=[];for await(const e of t.listEntities<{payload:string}>({queryOptions:{filter:`PartitionKey eq 'requests-walkthrough20260920-${employeeId}'`}}))records.push(JSON.parse(e.payload));return records.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
/** Server-only planning input. Callers must authorize manager access and scope returned insights to their department. */
export async function listPlanningBookings():Promise<Booking[]>{const t=await table();if(!t)return local(s=>s.bookings);const records:Booking[]=[];for await(const e of t.listEntities<{payload:string}>({queryOptions:{filter:"PartitionKey ge 'requests-walkthrough20260920-' and PartitionKey lt 'requests-walkthrough20260920.'"}}))records.push(JSON.parse(e.payload));return records;}
export async function saveBooking(b:Booking,createOnly=false){const t=await table();if(!t)return local(s=>{const i=s.bookings.findIndex(x=>x.id===b.id);if(i>=0&&createOnly)return s.bookings[i];if(i>=0)s.bookings[i]=b;else s.bookings.push(b);return b});const entity={partitionKey:'requests-walkthrough20260920-'+b.employeeId,rowKey:b.id,payload:JSON.stringify(b)};if(createOnly){try{await t.createEntity(entity)}catch(e){if((e as {statusCode?:number}).statusCode!==409)throw e;return JSON.parse((await t.getEntity<{payload:string}>(entity.partitionKey,entity.rowKey)).payload) as Booking}}else await t.upsertEntity(entity,'Replace');return b}
export async function listInvitations(employeeId:string):Promise<LeaveInvitation[]>{
 if(!/^SYN\d+$/.test(employeeId))throw new Error('Invalid employee.');
 const t=await table();if(!t)return local(s=>(s.invitations||[]).filter(i=>i.employeeId===employeeId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
 const rows:LeaveInvitation[]=[];for await(const e of t.listEntities<{payload:string}>({queryOptions:{filter:`PartitionKey eq 'invitations-walkthrough20260920-${employeeId}'`}}))rows.push(JSON.parse(e.payload));return rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export async function saveInvitation(invitation:LeaveInvitation){
 const t=await table();if(!t)return local(s=>{s.invitations=s.invitations||[];const index=s.invitations.findIndex(i=>i.id===invitation.id&&i.employeeId===invitation.employeeId);if(index>=0)s.invitations[index]=invitation;else s.invitations.push(invitation);return invitation});
 await t.upsertEntity({partitionKey:'invitations-walkthrough20260920-'+invitation.employeeId,rowKey:invitation.id,payload:JSON.stringify(invitation)},'Replace');return invitation;
}
export async function audit(employeeId:string,action:string,detail:unknown){const entry={at:new Date().toISOString(),action,detail};const payload=JSON.stringify(entry).slice(0,30000);const t=await table();if(t)await t.createEntity({partitionKey:'audit-'+employeeId,rowKey:crypto.randomUUID(),payload});else await local(s=>{s.audit.push(entry)})}
async function increment(key:string,limit:number){const t=await table();if(!t)return local(s=>{const n=s.usage[key]||0;if(n>=limit)throw new Error('Assistant usage limit reached. Please try again later.');s.usage[key]=n+1});for(let attempt=0;attempt<5;attempt++){try{const e=await t.getEntity<{count:number}>('usage',key);if(e.count>=limit)throw new Error('Assistant usage limit reached. Please try again later.');await t.updateEntity({partitionKey:'usage',rowKey:key,count:e.count+1},'Replace',{etag:e.etag});return}catch(e){const status=(e as {statusCode?:number}).statusCode;if(status===404){try{await t.createEntity({partitionKey:'usage',rowKey:key,count:1});return}catch(err){if((err as {statusCode?:number}).statusCode===409)continue;throw err}}if(status===412)continue;throw e}}throw new Error('Assistant is busy. Try again shortly.')}
export async function reserveTurn(employeeId:string){const hour=new Date().toISOString().slice(0,13),day=hour.slice(0,10);await increment(`global-${day}`,Math.min(100,Number(process.env.CHAT_DAILY_LIMIT)||100));await increment(`${employeeId}-${hour}`,20)}
export async function reserveLogin(ipHash:string){await increment(`login-global-${new Date().toISOString().slice(0,13)}`,100);await increment(`login-${ipHash}-${new Date().toISOString().slice(0,13)}`,15)}

const localLocks=new Map<string,Promise<unknown>>();
export async function withEmployeeLock<T>(employeeId:string,action:()=>Promise<T>):Promise<T>{const t=await table();if(!t){const prior=localLocks.get(employeeId)||Promise.resolve();const work=prior.catch(()=>{}).then(action);localLocks.set(employeeId,work);try{return await work}finally{if(localLocks.get(employeeId)===work)localLocks.delete(employeeId)}}
 const owner=crypto.randomUUID(),entity={partitionKey:'locks',rowKey:employeeId,owner,expires:Date.now()+120000};
 try{await t.createEntity(entity)}catch(e){if((e as {statusCode?:number}).statusCode!==409)throw e;const current=await t.getEntity<{owner:string;expires:number}>('locks',employeeId);if(current.expires>Date.now())throw new Error('Another request is being saved. Please retry shortly.');try{await t.updateEntity(entity,'Replace',{etag:current.etag})}catch{throw new Error('Another request is being saved. Please retry shortly.')}}
 try{return await action()}finally{try{const current=await t.getEntity<{owner:string}>('locks',employeeId);if(current.owner===owner)await t.deleteEntity('locks',employeeId,{etag:current.etag})}catch{}}
}
