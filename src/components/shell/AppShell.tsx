'use client';
import { useEffect, useState } from 'react';
import { Bell, BookOpen, CalendarDays, ChevronDown, ClipboardList, Heart, Home, Users } from 'lucide-react';
import './reference-shell.css';
const navigation = [
 {id:'planning',label:'My Leave',Icon:Home},
 {id:'overview',label:'Calendar',Icon:CalendarDays},
 {id:'workspace',label:'Requests',Icon:ClipboardList},
 {id:'coverage',label:'Team Leave',Icon:Users},
 {id:'policies',label:'Resources',Icon:BookOpen},
];
export default function AppShell({children}:{children:React.ReactNode}) {
 const [active,setActive]=useState('overview');
 const [menu,setMenu]=useState(false);
 const [notifications,setNotifications]=useState(false);
 useEffect(()=>{const update=()=>{setActive(window.location.hash.slice(1)||({'/manager':'coverage','/planner':'overview','/demo':'data','/teams-preview':'coverage'} as Record<string,string>)[window.location.pathname]||'overview');setMenu(false);setNotifications(false);};update();window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);},[]);
 const manager=active==='coverage'||active==='audit'||active==='fairness';
 return <div className="reference-shell"><a className="skip-link" href="#main-content">Skip to content</a><header className="ref-topbar"><a href="/#overview" className="ref-logo" aria-label="GimmeABreak home"><span>gimme<span>abreak</span><b>!</b></span><i>+</i></a><nav aria-label="Main navigation">{navigation.map(({id,label,Icon})=><a key={id} href={`/#${id}`} className={active===id?'active':''} aria-current={active===id?'page':undefined}><Icon size={21}/>{label}</a>)}</nav><div className="ref-account"><div className="ref-notifications"><button className="ref-bell" aria-label="Notifications" aria-expanded={notifications} onClick={()=>{setNotifications(!notifications);setMenu(false);}}><Bell size={24}/><i/></button>{notifications&&<div className="ref-account-menu"><strong>Updates</strong><a href="/#coverage">Sarah’s leave request needs review<ChevronDown size={14}/></a><a href="/#policies">Four checks need further evidence</a></div>}</div><button className="ref-profile" aria-expanded={menu} onClick={()=>{setMenu(!menu);setNotifications(false);}}><span className="ref-profile-avatar">{manager?'MT':'SC'}</span><span><strong>{manager?'Michael Tan':'Sarah Chen'}</strong><small>{manager?'Workforce Manager':'Resident Medical Officer'}</small></span><ChevronDown size={18}/></button>{menu&&<div className="ref-account-menu"><strong>Workspace</strong><a href="/#overview">My leave calendar</a><a href="/#coverage">Manager workspace</a><a href="/#data">Data sources</a><a href="/#audit">Activity history</a><a href="/#fairness">Fairness explorer</a><button onClick={()=>{window.dispatchEvent(new Event('coverassist:reset'));setMenu(false);}}>Clear assessment</button></div>}</div></header><main id="main-content" tabIndex={-1}>{children}</main><footer className="ref-footer"><span><Heart size={19}/>People take better care, when they take a break.</span><span>GimmeABreak <i/> Healthier humans. Brighter tomorrows.</span></footer></div>;
}
