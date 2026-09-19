import type {Balance} from './workforce-types';

export type CalendarLeave = {id:string;employeeId:string;start:string;end:string;code:string;type:string;status:string;source:'imported'|'request';hours:number|null;recordType:string;originalStart:string;originalEnd:string;hoursBasis:string};
export type LeaveHistory = {year:number;code:string;type:string;hours:number;records:number;basis:string;omittedRecords:number};
export type DepartmentEmployee = {id:string;name:string;role:string;rate:string;balances:Balance[];leave:CalendarLeave[];history:LeaveHistory[];excess:boolean;membershipBasis:string;historyNote:string;contractStatus:'verified'|'unresolved'};
export type DepartmentInsights = {month:string;asOf:string;unit:string;employees:DepartmentEmployee[];limitations:string[]};
export type LeaveSuggestion = {id:string;dates:string[];hours:number;remainingHours:number;affectedShifts:number;otherLeaveCount:number;reason:string;staffingBefore:number;staffingAfter:number;staffingBasis:string};
export type LeavePlan = {employeeId:string;name:string;leaveCode:string;balanceHours:number;bookedHours:number|null;reason:string;policyUrl:string;suggestions:LeaveSuggestion[];limitations:string[];eligible:boolean;leaveType:string;balanceEffectiveDate:string|null};
