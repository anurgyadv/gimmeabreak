'use client';
import Link from 'next/link';
import { ArrowRight, RotateCcw, CalendarDays, MessageSquare, ShieldCheck } from 'lucide-react';
import { useDemo } from '@/lib/demo-context';

export default function DemoPage() {
  const demo = useDemo();
  return <div className="demo-page">
    <p className="eyebrow">THE COMPLETE STORY</p><h1>A little time off.<br />A better way forward.</h1>
    <p className="muted">Explore the CoverAssist prototype with a fully synthetic November roster.</p>
    <div className="demo-steps">
      <section className="panel"><CalendarDays /><h2>1. Explore your leave</h2><p>Select 18–20 November to see the senior coverage constraint. Find better dates or ask Sarah to help.</p><Link className="button primary" href="/planner">Open leave planner <ArrowRight size={16} /></Link></section>
      <section className="panel"><MessageSquare /><h2>2. Coordinate cover</h2><p>Write a personal note, preview the simulated Teams card, and switch to Sarah to accept.</p><Link className="button secondary" href="/teams-preview">Open cover inbox <ArrowRight size={16} /></Link></section>
      <section className="panel"><ShieldCheck /><h2>3. Make the decision</h2><p>Revalidate the roster, see feasibility move from 31 to 94, then approve as the manager.</p><Link className="button secondary" href="/manager">Open manager view <ArrowRight size={16} /></Link></section>
    </div>
    <section className="panel demo-settings"><div><h2>Demo controls</h2><p className="muted">State stays in this browser. Reset restores the original roster.</p></div>
      <label className="toggle-label"><input type="checkbox" checked={demo.teamsUnavailable} disabled={!!demo.busy} onChange={event => void demo.setTeamsUnavailable(event.target.checked)} />Use internal Cover Inbox instead of Teams preview</label>
      <button className="button secondary" disabled={!!demo.busy} onClick={() => void demo.reset()}><RotateCcw size={15} /> Reset demo</button>
    </section>
    <p className="demo-disclosure">Synthetic identities and rules · Simulated AI and messaging · Designed for future Microsoft Teams and Azure integration</p>
  </div>;
}
