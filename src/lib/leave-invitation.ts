export type LeaveInvitation={
 id:string;employeeId:string;employeeName:string;leaveCode:string;message:string;
 dates:string[];hours:number;balanceHours:number;remainingHours:number;
 status:'invited'|'interested'|'discuss';createdAt:string;updatedAt:string;
 sender:string;reason:string;policyUrl:string;staffingNote:string;
};
