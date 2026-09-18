'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MotionConfig } from 'motion/react';
import { CalendarDays, MessageSquare, ShieldCheck, SlidersHorizontal, RotateCcw, ArrowUpRight, X, Activity, LoaderCircle } from 'lucide-react';
import { DemoProvider, useDemo } from '@/lib/demo-context';

const navigation = [
  { href:'/planner', label:'Leave planner', Icon:CalendarDays },
  { href:'/teams-preview', label:'Cover inbox', Icon:MessageSquare },
  { href:'/manager', label:'Manager view', Icon:ShieldCheck },
  { href:'/demo', label:'Demo guide', Icon:SlidersHorizontal },
];

function ShellContent({ children }: { children:React.ReactNode }) {
  const path = usePathname();
  const demo = useDemo();
  const [teamsHost, setTeamsHost] = useState(false);
  const [hostTheme, setHostTheme] = useState('light');
  const [deepLinked, setDeepLinked] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTeamsHost(params.get('host') === 'teams');
    setHostTheme(params.get('theme') === 'dark' ? 'dark' : params.get('theme') === 'contrast' ? 'contrast' : 'light');
  }, [path]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (demo.ready && !demo.busy && !demo.evaluation && !deepLinked && params.get('subEntityId')?.startsWith('leave-')) {
      setDeepLinked(true);
      void demo.evaluate('2026-11-18','2026-11-20');
    }
  }, [demo.ready,demo.busy,demo.evaluation,deepLinked,demo.evaluate]);
  const active = navigation.find(item => path === item.href) ?? navigation[0];
  return <div className={`app-shell ${teamsHost ? 'teams-host' : ''}`} data-theme={teamsHost ? hostTheme : 'light'}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    {!teamsHost && <aside className="sidebar">
      <Link href="/planner" className="brand" aria-label="CoverAssist home"><span className="brand-mark"><Activity size={23} strokeWidth={2.5} /></span><span>Cover<span className="brand-light">Assist</span><small>SPACE TO TAKE A BREAK</small></span></Link>
      <div className="workspace-label">WORKSPACE</div>
      <nav aria-label="Main navigation">{navigation.map(({href,label,Icon}) => <Link key={href} href={href} className={`nav-item ${active.href===href?'active':''}`} aria-current={active.href===href?'page':undefined}><Icon size={19} />{label}{href==='/teams-preview' && demo.coverRequest?.status==='sent' && <span className="nav-count">1</span>}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="integration-card"><span className="integration-icon">M</span><strong>Built around your team</strong><p>Designed for Microsoft Teams &amp; Azure integration.</p><Link href="/demo">Explore the prototype <ArrowUpRight size={13} /></Link></div><div className="sidebar-person"><span className="avatar">AR</span><div><strong>Dr Anurag Rao</strong><small>Senior clinician</small></div><span className="online-dot" /></div></div>
    </aside>}
    <div className="app-workspace">
      <header className="topbar"><div className="breadcrumb">{teamsHost && <span className="teams-host-label">Microsoft Teams <span>·</span></span>}General Medicine <span className="breadcrumb-slash">/</span> <strong>{active.label}</strong></div><div className="topbar-actions"><span className="prototype-pill"><span /> Prototype</span><button className="reset-button" disabled={!!demo.busy || !demo.ready} onClick={() => {setDeepLinked(true); void demo.reset();}}><RotateCcw size={14} /><span>Reset demo</span></button></div></header>
      <nav className="mobile-nav" aria-label="Views">{navigation.map(({href,label,Icon}) => <Link key={href} href={href} aria-current={active.href===href?'page':undefined}><Icon size={16}/><span>{label}</span></Link>)}</nav>
      <main id="main-content" tabIndex={-1}>
        {!demo.ready ? <div className="startup-state"><span className="brand-mark"><Activity size={30}/></span><h1>A better way to plan leave.</h1><p className="muted">Preparing your synthetic roster…</p><LoaderCircle className="spinner" size={22}/>{demo.error && <p role="alert">{demo.error}</p>}</div> : children}
      </main>
      <footer className="app-footer"><span><span className="footer-dot"/> Synthetic demo data</span><span>Coverage feasibility, with people in the loop.</span></footer>
    </div>
    {demo.error && demo.ready && <div className="global-notice" role="alert"><span>{demo.error}</span><button aria-label="Dismiss message" onClick={demo.clearError}><X size={17}/></button></div>}
    {demo.busy && <div className="busy-toast" role="status"><LoaderCircle size={16} className="spinner"/>{demo.busy}</div>}
  </div>;
}

export default function AppShell({children}:{children:React.ReactNode}) {
  return <MotionConfig reducedMotion="user"><DemoProvider><ShellContent>{children}</ShellContent></DemoProvider></MotionConfig>;
}
