export type FeasibilityStatus = 'easy' | 'good' | 'cover-needed' | 'difficult';
export type ClinicianClassification = 'SMO' | 'REG' | 'RMO';
export type ShiftType = 'DAY' | 'EVENING' | 'NIGHT';
export interface Clinician { id:string; displayName:string; initials:string; role:'clinician'|'roster-manager'; wardId:string; wardName:string; classification:ClinicianClassification; skills:string[]; avatarUrl?:string }
export interface Shift {id:string; date:string; shiftType:ShiftType; start:string; end:string; wardId:string; clinicianId:string}
export interface StaffingRule {id:string; name:string; scope:{wardId?:string; shiftType?:ShiftType}; type:'minimum-staff'|'minimum-classification'|'minimum-rest-hours'|'maximum-weekly-hours'; severity:'hard'|'soft'; parameters:Record<string,string|number|boolean>; explanation:string}
export interface RuleViolation {ruleId:string; ruleName:string; date:string; severity:'hard'|'soft'; required?:number; available?:number; actual?:number; unit?:string; explanation:string}
export interface CoverageMetric {id:'total-staff'|'senior-cover'|'skill-mix'; label:string; before:number; after:number; required:number; unit:'staff'|'percent'; satisfied:boolean}
export interface LeaveDayFeasibility {date:string; score:number; status:FeasibilityStatus; label:string; primaryReason?:string}
export interface LeaveEvaluation {evaluationId:string; clinicianId:string; startDate:string; endDate:string; feasible:boolean; score:number; status:FeasibilityStatus; limitingDate?:string; metrics:CoverageMetric[]; violations:RuleViolation[]; summary:string}
export interface LeaveWindow {startDate:string; endDate:string; score:number; status:FeasibilityStatus; coverRequired:boolean; explanation:string}
export interface CoverOption {id:string; strategy:'swap'|'replacement'|'alternate-dates'; clinicianId?:string; clinicianName?:string; classification?:ClinicianClassification; score:number; rank:number; recommended:boolean; overtimeHours:number; rosterChanges:number; restCompliant:boolean; qualificationCompliant:boolean; downstreamConflict?:{date:string; ruleId:string; explanation:string}; explanation:string}
export interface CoverRequest {id:string; leaveEvaluationId:string; requesterId:string; recipientId:string; recipientName:string; optionId:string; personalNote?:string; status:'draft'|'sent'|'accepted'|'declined'|'revalidated'; sentAt?:string; respondedAt?:string}
export interface RevalidationResult {coverRequestId:string; valid:boolean; beforeScore:number; afterScore:number; checks:Array<{ruleId:string; label:string; passed:boolean}>}
export interface AuditEvent {id:string; label:string; at:string}
export interface DemoSnapshot {evaluation:LeaveEvaluation|null; coverRequest:CoverRequest|null; revalidation:RevalidationResult|null; approved:boolean; audit:AuditEvent[]; teamsUnavailable:boolean}
export interface EvaluateInput {clinicianId:string; startDate:string; endDate:string}
export type NoteTone = 'friendly'|'brief'|'professional';
export interface DemoContextValue extends DemoSnapshot {
  ready:boolean; busy:string|null; error:string|null; me:Clinician|null; calendar:LeaveDayFeasibility[]; windows:LeaveWindow[]; options:CoverOption[];
  evaluate:(startDate:string,endDate:string)=>Promise<void>;
  findWindows:()=>Promise<void>; loadOptions:()=>Promise<void>;
  rephrase:(text:string,tone:NoteTone)=>Promise<string>;
  requestCover:(optionId:string,personalNote:string)=>Promise<void>;
  respond:(response:'accepted'|'declined')=>Promise<void>;
  revalidate:()=>Promise<void>; approve:()=>Promise<void>; reset:()=>Promise<void>;
  setTeamsUnavailable:(value:boolean)=>Promise<void>; clearError:()=>void;
}
