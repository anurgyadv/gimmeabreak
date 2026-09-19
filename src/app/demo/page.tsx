import Link from 'next/link';
import { ArrowLeft, Database, FileCheck2, GitBranch, ShieldCheck } from 'lucide-react';
import demo from '@/data/coverassist-demo.json';

export default function DemoPage() {
  const totalRows = demo.provenance.sourceFiles.reduce((sum, file) => sum + file.rowCount, 0);
  return <div className="demo-page">
    <p className="eyebrow">DEMO GUIDE</p>
    <h1>The data behind the story</h1>
    <p className="muted">The runtime is deliberately small. The preparation script reads the full supplied files, applies the same joins and calculations, then packages the evidence needed for a reliable offline demonstration.</p>
    <div className="demo-steps">
      <section className="panel"><Database /><h2>{totalRows.toLocaleString()} source rows</h2><p>Contracts, leave balances, leave records and roster shifts retain their original column structure and provenance.</p></section>
      <section className="panel"><GitBranch /><h2>Deterministic tools</h2><p>Dates, shift hours, conflicts, pay-period capacity and prior-unit experience are calculated before any explanation is written.</p></section>
      <section className="panel"><ShieldCheck /><h2>Human decision</h2><p>The system surfaces evidence and unknowns. It does not invent policy rules or approve leave autonomously.</p></section>
    </div>
    <section className="panel demo-settings"><div><h2>Golden-path record</h2><p className="muted">SYN001597 · Annual leave · 21 September 2026 · SU0325 ED shift</p></div><div><h2>Eligible options</h2><p className="muted">SYN000894 and SYN001237 · 79.5 / 80 projected hours</p></div><Link className="button primary" href="/"><ArrowLeft size={15} /> Return to interactive story</Link></section>
    <p className="demo-disclosure"><FileCheck2 size={13} /> The derived JSON can be regenerated from the supplied CSVs with scripts/prepare_demo_data.py.</p>
  </div>;
}
