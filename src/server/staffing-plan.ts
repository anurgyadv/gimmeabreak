import {TableClient} from '@azure/data-tables';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import raw from '../data/workforce.json';
import type {Booking,SwapOption,Workforce} from '../lib/workforce-types';
import {bands,roles,coverage,floorKey,interval,type Floors} from '../lib/staffing-requirements';
import {datesBetween,projectedRoster} from '../lib/workforce-engine';
const workforce=raw as Workforce;
const dates=datesBetween(workforce.period.start,workforce.period.end);
export function validateFloors(input:unknown):Floors{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Provide staffing floors.');
 const allowed=new Set(dates.flatMap(d=>bands.flatMap((_,b)=>roles.map(r=>floorKey(d,b,r)))));
 const result:Floors={};for(const [key,value] of Object.entries(input)){if(!allowed.has(key)||!(value===null||typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=30))throw new Error('Invalid staffing floor.');result[key]=value as number|null;}return result;
}
let initialized:Promise<TableClient>|undefined;
async function table(){if(process.env.CHAT_LOCAL_STORE||!process.env.AZURE_STORAGE_CONNECTION_STRING)return null;if(!initialized)initialized=(async()=>{const t=TableClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING!,'GimmeWorkforce');await t.createTable().catch(e=>{if(e.statusCode!==409)throw e});return t})().catch(e=>{initialized=undefined;throw e});return initialized;}
const localFile=()=>process.env.CHAT_LOCAL_STORE?process.env.CHAT_LOCAL_STORE+'.staffing.json':path.join(process.cwd(),'.release-local','staffing-plan.json');
const partition='staffing-'+workforce.unit,row=workforce.period.start;
export async function getStaffingFloors():Promise<Floors>{const t=await table();if(t){try{return validateFloors(JSON.parse((await t.getEntity<{payload:string}>(partition,row)).payload))}catch(e){if((e as {statusCode?:number}).statusCode===404)return {};throw e}}
 if(process.env.NODE_ENV==='production'&&!process.env.CHAT_LOCAL_STORE)throw new Error('Persistent storage is not connected.');
 try{return validateFloors(JSON.parse(await readFile(/* turbopackIgnore: true */ localFile(),'utf8')))}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {};throw e}
}
export async function saveStaffingFloors(input:Floors){const floors=validateFloors(input),t=await table();if(t)await t.upsertEntity({partitionKey:partition,rowKey:row,payload:JSON.stringify(floors)},'Replace');else{if(process.env.NODE_ENV==='production'&&!process.env.CHAT_LOCAL_STORE)throw new Error('Persistent storage is not connected.');await mkdir(path.dirname(localFile()),{recursive:true});await writeFile(localFile(),JSON.stringify(floors))}return floors;}
export type StaffingImpact={date:string;band:string;role:string;minimum:number|null;before:number;after:number;shortfall:number|null};
/** Floors are operating settings, not statutory clinical ratios. Pending leave is conservatively reserved. */
export function staffingImpact(selected:string[],requests:Booking[],floors:Floors,swap?:SwapOption|null,w:Workforce=workforce):StaffingImpact[]{
 const pending=requests.filter(r=>!['approved','declined','changes-requested','colleague-declined'].includes(r.status));
 const base:Workforce={...w,shifts:projectedRoster(w,requests).filter(s=>!pending.some(r=>r.employeeId===s.employeeId&&r.dates.includes(s.date))),leave:[...w.leave,...pending.flatMap(r=>r.dates.map(date=>({employeeId:r.employeeId,type:r.leaveType,code:r.leaveCode,start:date,end:date,hours:0,status:'Pending',recordType:'App request'})))]};
 const removed=base.shifts.filter(s=>s.employeeId===w.employeeId&&selected.includes(s.date));
 const removedIds=new Set(removed.map(s=>s.id));
 const after:Workforce={...base,shifts:base.shifts.filter(s=>!removedIds.has(s.id))};
 const touched=[...removed];
 if(swap&&removedIds.has(swap.outgoing.id)){
  after.shifts.push({...swap.outgoing,employeeId:swap.employeeId});
  if(swap.returnShift){after.shifts=after.shifts.filter(s=>s.id!==swap.returnShift!.id);after.shifts.push({...swap.returnShift,employeeId:w.employeeId});touched.push(swap.returnShift)}
 }
 return datesBetween(w.period.start,w.period.end).flatMap(date=>bands.flatMap((b,index)=>{
  const [a,z]=interval({date,...b});
  const affectedRoles=new Set(touched.filter(s=>{const[x,y]=interval(s);return s.unit===w.unit&&x<z&&a<y}).map(s=>w.employees.find(e=>e.id===s.employeeId)?.role).filter((r):r is string=>!!r));
  return [...affectedRoles].map(role=>{const minimum=floors[floorKey(date,index,role)]??null,before=coverage(base,date,index,role),count=coverage(after,date,index,role);return{date,band:b.name,role,minimum,before,after:count,shortfall:minimum===null?null:Math.max(0,minimum-count)}});
 }));
}

export function withStaffingChecks(option:SwapOption,dates:string[],requests:Booking[],floors:Floors):SwapOption{
 const impact=staffingImpact(dates,requests,floors,option);
 return {...option,checks:[...option.checks,...impact.map((s,i)=>({id:'floor-'+i,label:`${s.date} ${s.band}: ${s.role}`,status:s.minimum!==null&&s.shortfall===0?'pass' as const:'warning' as const,detail:s.minimum===null?`After this arrangement: ${s.after} present. The staffing minimum is not configured.`:`Minimum ${s.minimum}; ${s.after} remain after this arrangement.${s.shortfall?` Still short by ${s.shortfall}; further cover is needed.`:' Configured minimum maintained.'}`,source:'Manager operating floor + both-sided roster simulation'}))]};
}
