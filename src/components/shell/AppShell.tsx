'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, ArrowUpRight, Database, PlayCircle, RotateCcw } from 'lucide-react';

const navigation = [
  { href:'/', label:'Interactive story', Icon:PlayCircle },
  { href:'/demo', label:'Data and demo guide', Icon:Database },
];

export default function AppShell({children}:{children:React.ReactNode}) {
  const pathname = usePathname();
  const activeLabel = pathname === '/demo' ? 'Data and demo guide' : 'Interactive story';
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="CoverAssist home"><span className="brand-mark"><Activity size={23} strokeWidth={2.5} /></span><span>Cover<span className="brand-light">Assist</span><small>LEAVE IMPACT, EXPLAINED</small></span></Link>
      <div className="workspace-label">WORKSPACE</div>
      <nav aria-label="Main navigation">{navigation.map(({href,label,Icon}) => <Link key={href} href={href} className={`nav-item ${pathname===href?'active':''}`} aria-current={pathname===href?'page':undefined}><Icon size={19} />{label}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="integration-card"><span className="integration-icon">M</span><strong>Built for the conversation</strong><p>Real synthetic records, deterministic checks and a clear path to Microsoft integration.</p><Link href="/demo">See the evidence <ArrowUpRight size={13} /></Link></div><div className="sidebar-person"><span className="avatar">CA</span><div><strong>Hackathon demo</strong><small>Human decision retained</small></div><span className="online-dot" /></div></div>
    </aside>
    <div className="app-workspace">
      <header className="topbar"><div className="breadcrumb">Synthetic workforce data <span className="breadcrumb-slash">/</span> <strong>{activeLabel}</strong></div><div className="topbar-actions"><span className="prototype-pill"><span /> Interactive prototype</span><button className="reset-button" onClick={() => window.dispatchEvent(new Event('coverassist:reset'))}><RotateCcw size={14} /><span>Reset story</span></button></div></header>
      <nav className="mobile-nav" aria-label="Views">{navigation.map(({href,label,Icon}) => <Link key={href} href={href}><Icon size={16}/><span>{label}</span></Link>)}</nav>
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="app-footer"><span><span className="footer-dot"/> Derived from supplied synthetic workforce files</span><span>Evidence for the manager. Decision with the manager.</span></footer>
    </div>
  </div>;
}
