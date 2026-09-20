'use client';
import {useState} from 'react';
import {ArrowLeft,ArrowRight,Play,X} from 'lucide-react';
const steps=[
 {title:'Start with your leave',route:'home',tip:'Show balances and the upcoming roster. Sarah has long-service leave to plan.'},
 {title:'Ask for a break',route:'book',tip:'21 September is selected. Start the booking check, then show the reasons and a swap option.'},
 {title:'Explain and find a solution',route:'book',tip:'Open the assistant: “Check annual leave for 21 September. Explain the blockers and find shift options.” Confirm a request only once.'},
 {title:'Review as the manager',route:'manager-requests',tip:'Open the submitted request. Show the proposed cover and policy checks before making a decision.'},
 {title:'See the department',route:'manager-calendar',tip:'Show overlapping leave, then select an employee to inspect balances and history.'},
 {title:'Explore staffing floors',route:'manager-staffing',tip:'Set the RN minimum to 11 for 21 September, Day. The comparison shows coverage falling to 10.'},
 {title:'Plan leave proactively',route:'manager-planning',tip:'Review Sarah’s long-service balance, choose a suggested date and send an in-app invitation.'},
 {title:'Close the loop',route:'home',tip:'Show the compact manager message. Review the dates or ask to discuss them.'},
];
export default function WalkthroughGuide({onNavigate}:{onNavigate:(route:string,step:number)=>void}){
 const[open,setOpen]=useState(false),[index,setIndex]=useState(0);
 function go(i:number){setIndex(i);onNavigate(steps[i].route,i)}
 if(!open)return <div className="wf-guide-launch"><button onClick={()=>{setOpen(true);go(0)}}><Play size={14}/>Presentation guide</button></div>;
 return <section className="wf-guide" aria-label="Presentation guide"><div><small>WALKTHROUGH · {index+1} / {steps.length}</small><strong>{steps[index].title}</strong><p>{steps[index].tip}</p></div><div className="wf-guide-controls"><button aria-label="Previous step" disabled={index===0} onClick={()=>go(index-1)}><ArrowLeft size={17}/></button><button onClick={()=>go(index===steps.length-1?0:index+1)}>{index===steps.length-1?'Back to start':'Next'}<ArrowRight size={16}/></button><button aria-label="Close presentation guide" onClick={()=>setOpen(false)}><X size={17}/></button></div></section>
}
