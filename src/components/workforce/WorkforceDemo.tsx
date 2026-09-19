'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseMedical,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Database,
  FileSearch,
  Hospital,
  MessageSquareText,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import rawDemo from '@/data/coverassist-demo.json';
import './workforce.css';

type Candidate = {
  employeeId: string;
  role: string;
  rateId: string;
  contractHours: number;
  currentPayPeriodHours: number;
  projectedPayPeriodHours: number;
  rosterConflict: boolean;
  leaveConflict: boolean;
  homeUnit: string;
  priorUnitShiftCount: number;
  lastWorkedInUnit?: string | null;
};

type DemoData = {
  provenance: {
    decisionDate: string;
    dataVersion: string;
    sourceFiles: Array<{ kind: string; fileName: string; rowCount: number; columns: string[] }>;
    quality: { exactDuplicateCounts: Record<string, number>; invalidDateCounts: Record<string, number>; trimmedWorkCodeCount: number };
  };
  scenario: {
    employee: { employeeId: string; role: string; rateId: string; contractHours: number; homeUnit: string; occupationalGroup?: string };
    request: { leaveType: string; startDate: string; endDate: string; requestedHours: number };
    balance: { status: string; explanation?: string; futureSnapshot?: { effectiveDate: string; remainingHours: number } | null };
    affectedShifts: Array<{ rosterUnit: string; rosterUnitDescription?: string; shiftDate: string; startTime: string; endTime: string; mealBreakMinutes: number; netHours: number; workCode?: string; payPeriodStart?: string; payPeriodEnd?: string }>;
    candidates: Candidate[];
    eligibleCandidatePoolSize?: number;
    candidateSelectionNote?: string;
    policyChecks: Array<{ id?: string; name?: string; label?: string; result: 'pass' | 'fail' | 'unknown'; explanation?: string; requiresManagerReview?: boolean }>;
    toolTrace: Array<{ id?: string; label?: string; name?: string; status?: string }>;
  };
};

const demo = rawDemo as DemoData;
const steps = ['Request', 'Analyse', 'Review', 'Coordinate'];
const toolLabels = [
  'Resolving employee and contract',
  'Checking leave balance by effective date',
  'Finding affected roster shifts',
  'Calculating coverage impact',
  'Filtering compatible clinicians',
  'Checking available workforce rules',
];

const questions = [
  'Why does this need manager attention?',
  'How were the two clinicians selected?',
  'How is 79.5 hours calculated?',
  'What information was deliberately excluded?',
  'What would connect in production?',
];

function formatDate(value?: string) {
  if (!value) return 'Unavailable';
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function answerQuestion(question: string, candidates: Candidate[]) {
  const first = candidates[0];
  if (question.startsWith('Why')) {
    return 'The leave request overlaps a real rostered RMO shift in Synthetic Emergency Department. Candidate options were found, but the available policy links do not contain the rule text needed to declare the roster compliant, so a manager must decide.';
  }
  if (question.startsWith('How were')) {
    return 'The engine matched active contracts by occupational group, role and rate, then excluded anyone already rostered or on booked leave during the shift. Three people passed those hard filters; the demo shows the two with the most prior scheduled shifts in SU0325.';
  }
  if (question.startsWith('How is')) {
    return `${first?.employeeId ?? 'Each candidate'} has 71.5 rostered hours in the 21 Sep–4 Oct pay period. The affected 07:00–15:30 shift is 8 hours after its 30-minute meal break, producing 79.5 of 80 contracted hours.`;
  }
  if (question.startsWith('What information was')) {
    return 'Age and gender are present in the source contract file but are excluded from matching. Free-text personal leave reasons are also excluded. The engine uses role, rate, availability, conflicts, contract capacity and prior unit experience.';
  }
  return 'The same contracts can sit behind a FastAPI service and governed workforce database, with Microsoft Entra identity, Teams or Power Automate coordination, and verified policy rules. This demo keeps those integrations simulated so the core logic is reliable offline.';
}

export default function WorkforceDemo() {
  const { scenario, provenance } = demo;
  const shift = scenario.affectedShifts[0];
  const candidates = scenario.candidates;
  const [stage, setStage] = useState(0);
  const [running, setRunning] = useState(false);
  const [toolIndex, setToolIndex] = useState(-1);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [decision, setDecision] = useState<string | null>(null);
  const [question, setQuestion] = useState(questions[0]);
  const [showData, setShowData] = useState(false);
  const [coordinationResponse, setCoordinationResponse] = useState<string | null>(null);
  const analysisRun = useRef(0);
  const sourcePanel = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const reset = () => {
      analysisRun.current += 1;
      setStage(0);
      setRunning(false);
      setToolIndex(-1);
      setSelectedCandidate(null);
      setDecision(null);
      setCoordinationResponse(null);
    };
    window.addEventListener('coverassist:reset', reset);
    return () => window.removeEventListener('coverassist:reset', reset);
  }, []);

  const totalRows = useMemo(() => provenance.sourceFiles.reduce((sum, file) => sum + file.rowCount, 0), [provenance.sourceFiles]);

  async function runAnalysis() {
    if (running) return;
    analysisRun.current += 1;
    const run = analysisRun.current;
    setRunning(true);
    setStage(1);
    for (let index = 0; index < toolLabels.length; index += 1) {
      setToolIndex(index);
      await new Promise((resolve) => window.setTimeout(resolve, 420));
      if (analysisRun.current !== run) return;
    }
    setRunning(false);
    setStage(2);
  }

  function resetDemo() {
    window.dispatchEvent(new Event('coverassist:reset'));
  }

  function showDataPanel() {
    setShowData(true);
    window.requestAnimationFrame(() => sourcePanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  const stepIndex = stage === 2 ? 1 : stage === 3 ? 2 : stage === 4 ? 3 : stage;

  return (
    <div className="wf-demo">
      <section className="wf-hero">
        <div>
          <p className="eyebrow">INTERACTIVE WORKFORCE DEMO</p>
          <h1>Understand the roster impact before deciding leave.</h1>
          <p className="wf-lead">A scripted story powered by real synthetic workforce records and deterministic checks.</p>
        </div>
        <button className="wf-data-button" type="button" onClick={() => setShowData((value) => !value)} aria-expanded={showData}>
          <Database size={17} />
          <span><strong>{totalRows.toLocaleString()}</strong> source rows</span>
          <ChevronRight size={16} className={showData ? 'rotated' : ''} />
        </button>
      </section>

      {showData ? (
        <section className="wf-source-panel panel" ref={sourcePanel}>
          <div className="wf-section-head"><div><p className="eyebrow">DATA PROVENANCE</p><h2>Real source structure, focused demo subset</h2></div><span className="wf-live"><span /> Derived locally</span></div>
          <div className="wf-source-grid">
            {provenance.sourceFiles.map((file) => (
              <article key={file.kind}>
                <span>{file.kind}</span><strong>{file.rowCount.toLocaleString()}</strong><small>{file.columns.length} source fields</small><code>{file.columns.slice(0, 4).join(' · ')}{file.columns.length > 4 ? ' …' : ''}</code>
              </article>
            ))}
          </div>
          <div className="wf-quality-grid">
            <span><strong>{Object.values(provenance.quality.exactDuplicateCounts).reduce((sum, value) => sum + value, 0).toLocaleString()}</strong> exact duplicates identified</span>
            <span><strong>{provenance.quality.trimmedWorkCodeCount.toLocaleString()}</strong> work codes normalized</span>
            <span><strong>{Object.values(provenance.quality.invalidDateCounts).reduce((sum, value) => sum + value, 0).toLocaleString()}</strong> out-of-range or malformed dates quarantined</span>
          </div>
          <p className="wf-source-note">The demo packages only the records and aggregates needed for this story. Matching and calculations use the original field names and rules; age and gender never enter candidate selection.</p>
        </section>
      ) : null}

      <ol className="wf-stepper" aria-label="Demo progress">
        {steps.map((label, index) => (
          <li key={label} className={stepIndex >= index ? 'active' : ''} aria-current={stepIndex === index ? 'step' : undefined}>
            <span>{stepIndex > index ? <Check size={14} /> : index + 1}</span><strong>{label}</strong>
          </li>
        ))}
      </ol>

      <div className="wf-layout">
        <div className="wf-main">
          {stage === 0 ? (
            <section className="panel wf-request-card">
              <div className="wf-card-top">
                <div className="wf-person"><span className="wf-avatar">15</span><div><p className="eyebrow">DEMO EMPLOYEE</p><h2>{scenario.employee.employeeId}</h2><p>{scenario.employee.role} · {scenario.employee.rateId}</p></div></div>
                <span className="wf-chip"><BadgeCheck size={14} /> Active contract</span>
              </div>
              <div className="wf-scenario-lock"><FileSearch size={14} /><span>Fixed golden-path scenario derived from the supplied files</span></div>
              <div className="wf-form-grid">
                <label><span>Leave type</span><select value={scenario.request.leaveType} disabled aria-label="Leave type fixed for demo"><option>{scenario.request.leaveType}</option></select></label>
                <label><span>Start date</span><input type="date" value={scenario.request.startDate} readOnly aria-label="Start date fixed for demo" /></label>
                <label><span>End date</span><input type="date" value={scenario.request.endDate} readOnly aria-label="End date fixed for demo" /></label>
              </div>
              <label className="wf-note"><span>Personal note <small>Optional · excluded from matching</small></span><textarea placeholder="Add context for your manager if you want to" /></label>
              <div className="wf-request-summary">
                <CalendarDays size={18} /><div><strong>{formatDate(scenario.request.startDate)}</strong><span>{scenario.request.requestedHours} hours requested</span></div>
                <BriefcaseMedical size={18} /><div><strong>{scenario.employee.homeUnit}</strong><span>Contracted {scenario.employee.contractHours} hours</span></div>
              </div>
              <div className="wf-actions"><span>Nothing is submitted until you review the impact.</span><button className="button primary" type="button" onClick={() => void runAnalysis()}>Check my leave <ArrowRight size={16} /></button></div>
            </section>
          ) : null}

          {stage === 1 ? (
            <section className="panel wf-analysis-card" aria-live="polite">
              <div className="wf-orbit"><div className="wf-orbit-core"><Search size={24} /></div><span /><span /><span /></div>
              <p className="eyebrow">WORKFORCE ENGINE</p><h2>Following the evidence through your roster</h2>
              <div className="wf-tool-list">
                {toolLabels.map((label, index) => <div key={label} className={toolIndex >= index ? 'done' : toolIndex + 1 === index ? 'current' : ''}><span>{toolIndex >= index ? <Check size={13} /> : index + 1}</span>{label}</div>)}
              </div>
            </section>
          ) : null}

          {stage === 2 ? (
            <>
              <section className="wf-result-banner">
                <div><span className="wf-status-icon"><ShieldCheck size={22} /></span><div><p className="eyebrow">ANALYSIS COMPLETE</p><h2>Coverage options found. Manager review is required.</h2><p>One shift is affected. Three clinicians passed hard filters; the two strongest unit-experience examples are shown.</p></div></div>
                <button className="button primary" onClick={() => setStage(3)}>Open manager review <ArrowRight size={16} /></button>
              </section>
              <div className="wf-metrics">
                <article className="panel"><Clock3 /><span>Leave balance</span><strong>Unavailable</strong><small>No valid snapshot on {formatDate(provenance.decisionDate)}</small></article>
                <article className="panel"><Hospital /><span>Affected shifts</span><strong>{scenario.affectedShifts.length}</strong><small>{shift.rosterUnit} · {shift.startTime}–{shift.endTime}</small></article>
                <article className="panel"><Users /><span>Eligible pool</span><strong>{scenario.eligibleCandidatePoolSize ?? candidates.length}</strong><small>{candidates.length} shown · same role and rate</small></article>
              </div>
              <section className="panel wf-evidence-card">
                <div className="wf-section-head"><div><p className="eyebrow">AFFECTED ROSTER SHIFT</p><h2>{shift.rosterUnitDescription ?? 'Synthetic Emergency Department'}</h2></div><span className="wf-chip warning">Needs coordination</span></div>
                <div className="wf-shift-grid"><div><span>Date</span><strong>{formatDate(shift.shiftDate)}</strong></div><div><span>Shift</span><strong>{shift.startTime}–{shift.endTime}</strong></div><div><span>Meal break</span><strong>{shift.mealBreakMinutes} minutes</strong></div><div><span>Net hours</span><strong>{shift.netHours.toFixed(1)}</strong></div></div>
                <div className="wf-explanation"><FileSearch size={18} /><p>The request overlaps an RMO shift already assigned to {scenario.employee.employeeId}. The engine can identify compatible capacity, but it cannot claim clinical safety without verified staffing and credential rules.</p></div>
              </section>
            </>
          ) : null}

          {stage === 3 ? (
            <section className="panel wf-manager-card">
              <div className="wf-section-head"><div><p className="eyebrow">MANAGER REVIEW</p><h2>Choose a coverage option using the evidence</h2></div><span className="wf-chip"><UserCheck size={14} /> Human decision</span></div>
              <div className="wf-manager-summary"><div><span>Request</span><strong>{scenario.employee.employeeId} · {scenario.request.leaveType}</strong><small>{formatDate(scenario.request.startDate)} · {scenario.request.requestedHours} hours</small></div><div><span>Operational impact</span><strong>1 ED shift requires coordination</strong><small>RMO · {shift.startTime}–{shift.endTime}</small></div><div><span>Entitlement evidence</span><strong>Requires HR review</strong><small>{scenario.balance.futureSnapshot ? `${formatDate(scenario.balance.futureSnapshot.effectiveDate)} snapshot (${scenario.balance.futureSnapshot.remainingHours.toFixed(1)} h) is after decision date and was not used` : 'No decision-date balance available'}</small></div></div>
              <h3 className="wf-subheading">Eligible coverage options <span>· showing 2 of {scenario.eligibleCandidatePoolSize ?? candidates.length}</span></h3>
              <div className="wf-candidates">
                {candidates.map((candidate) => (
                  <button key={candidate.employeeId} type="button" className={selectedCandidate === candidate.employeeId ? 'selected' : ''} onClick={() => setSelectedCandidate(candidate.employeeId)}>
                    <div className="wf-candidate-head"><span className="wf-avatar">{candidate.employeeId.slice(-2)}</span><div><strong>{candidate.employeeId}</strong><small>{candidate.role} · {candidate.rateId}</small></div>{selectedCandidate === candidate.employeeId ? <span className="wf-selected"><Check size={13} /> Selected</span> : null}</div>
                    <div className="wf-hours"><div><span>Current pay period</span><strong>{candidate.currentPayPeriodHours}</strong></div><ChevronRight /><div><span>With this shift</span><strong>{candidate.projectedPayPeriodHours} / {candidate.contractHours}</strong></div></div>
                    <div className="wf-proof"><span><Check /> No roster conflict</span><span><Check /> No leave conflict</span><span><Check /> {candidate.priorUnitShiftCount} prior unit shifts</span></div>
                  </button>
                ))}
              </div>
              <div className="wf-policy-list">{scenario.policyChecks.map((check) => <div key={check.id ?? check.name}><span className={check.result}>{check.result}</span><div><strong>{check.name ?? check.label}</strong><p>{check.explanation}</p></div></div>)}</div>
              <div className="wf-policy"><CircleHelp size={18} /><div><strong>Policy evidence is intentionally incomplete</strong><p>The supplied links name relevant policies but do not contain their rule text. Unknown checks stay with the manager.</p></div></div>
              <div className="wf-decision-row"><button className="button secondary" onClick={() => setDecision('changes')}>Request changes</button><button className="button primary" disabled={!selectedCandidate} onClick={() => { setDecision('approved'); setStage(4); }}>Approve and coordinate <ArrowRight size={16} /></button></div>
              {decision === 'changes' ? <div className="wf-change-result" role="status"><Check size={16} /><div><strong>Changes requested</strong><p>This decision is recorded for the demo. In production, the employee would receive the manager’s requested changes.</p></div></div> : null}
            </section>
          ) : null}

          {stage === 4 ? (
            <section className="panel wf-coordinate-card">
              <div className="wf-success"><span><Check size={24} /></span><p className="eyebrow">MANAGER ACTION RECORDED</p><h2>Coverage coordination is ready.</h2><p>The leave decision stays with the manager. The next step is a simulated message to the selected clinician.</p></div>
              <div className="wf-teams-card">
                <div className="wf-teams-head"><span>M</span><div><strong>CoverAssist</strong><small>Simulated Teams coordination</small></div></div>
                <h3>Can you cover an RMO shift?</h3><p>{selectedCandidate}, the manager selected you as an eligible option for the following shift.</p>
                <dl><div><dt>Unit</dt><dd>{shift.rosterUnit} · Synthetic Emergency Department</dd></div><div><dt>Date</dt><dd>{formatDate(shift.shiftDate)}</dd></div><div><dt>Time</dt><dd>{shift.startTime}–{shift.endTime} · {shift.netHours} hours</dd></div><div><dt>Capacity</dt><dd>{candidates.find((item) => item.employeeId === selectedCandidate)?.projectedPayPeriodHours} / {candidates.find((item) => item.employeeId === selectedCandidate)?.contractHours} projected hours</dd></div></dl>
                <div className="wf-card-actions"><button onClick={() => setCoordinationResponse('Accepted')}>Accept</button><button onClick={() => setCoordinationResponse('Declined')}>Decline</button><button onClick={() => setCoordinationResponse('Question sent')}>Ask a question</button></div>
                {coordinationResponse ? <p className="wf-response" role="status"><Check size={13} /> Simulated response: {coordinationResponse}</p> : null}
              </div>
              <div className="wf-final-actions"><button className="button secondary" onClick={resetDemo}><RefreshCcw size={15} /> Replay story</button><button className="button primary" onClick={showDataPanel}><Database size={15} /> Show the data behind it</button></div>
            </section>
          ) : null}
        </div>

        <aside className="wf-side">
          <section className="panel wf-ask-card">
            <div className="wf-ask-title"><span><Sparkles size={18} /></span><div><p className="eyebrow">ASK THE EVIDENCE</p><h2>Questions judges may ask</h2></div></div>
            <div className="wf-question-list">{questions.map((item) => <button type="button" className={question === item ? 'active' : ''} key={item} onClick={() => setQuestion(item)}>{item}<ChevronRight size={14} /></button>)}</div>
            <div className="wf-answer" aria-live="polite"><MessageSquareText size={18} /><p>{answerQuestion(question, candidates)}</p></div>
          </section>
          <section className="panel wf-trace-card"><p className="eyebrow">DECISION TRACE</p><h2>Logic, not a black box</h2>{toolLabels.map((label, index) => <div key={label}><span>{index + 1}</span><p>{label}</p>{stage >= 2 ? <Check size={14} /> : null}</div>)}</section>
        </aside>
      </div>
      <p className="wf-disclosure">Synthetic workforce records · Deterministic calculations · Simulated AI explanation and Teams coordination · Human decision retained</p>
    </div>
  );
}
