import type {Workforce} from './workforce-types';
export function employeeDisplayName(id:string,w:Workforce){
 if(id===w.employeeId)return 'Sarah Chen';
 const i=w.employees.findIndex(e=>e.id===id);if(i<0)return 'Colleague '+id;
 return ['Emily','James','Priya','Daniel','Amelia','Oliver','Chloe','Ethan','Grace','Liam','Sophie','Noah','Aisha','Lucas','Isla','Mia'][i%16]+' '+['Zhang','Wilson','Kumar','Taylor','Nguyen','Patel','Williams','Brown','Martin','Lee','Thomas','Clarke','Harris','Wong','Walker'][Math.floor(i/16)%15];
}
