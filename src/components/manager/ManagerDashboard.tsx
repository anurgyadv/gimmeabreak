'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, ClipboardList, Loader2, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { useDemo } from '@/lib/demo-context';
import type { AuditEvent } from '@/lib/types';
import './manager.css';

const REQUESTER_NAME = 'Dr Anurag Rao';
const WARD_NAME = 'General Medicine';

function formatTime(at: string) {
  try {
    return new Date(at).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return at;
  }
}

export default function ManagerDashboard() {
  const { evaluation, coverRequest, revalidation, approved, audit, busy, error, approve, clearError } = useDemo();
  const isBusy = busy !== null;

  if (!evaluation) {
    return (
      <div className="md-shell">
        <Header />
        <div className="md-empty panel">
          <p>Nothing is ready for review yet.</p>
          <p className="muted">Once a clinician evaluates a leave request from the planner, it will appear here.</p>
          <Link className="button primary" href="/planner">
            Go to planner
          </Link>
        </div>
      </div>
    );
  }

  const currentCoverRequest = coverRequest && coverRequest.leaveEvaluationId === evaluation.evaluationId ? coverRequest : null;
  const currentRevalidation =
    currentCoverRequest && revalidation && revalidation.coverRequestId === currentCoverRequest.id ? revalidation : null;

  const noCoverNeeded = evaluation.feasible && !currentCoverRequest;
  const consentGiven = currentCoverRequest?.status === 'accepted' || currentCoverRequest?.status === 'revalidated';
  const revalidationValid = Boolean(currentRevalidation?.valid);

  const canApprove =
    !approved &&
    !isBusy &&
    (noCoverNeeded || (Boolean(currentCoverRequest) && consentGiven && revalidationValid));

  const approvedEvent = approved ? [...audit].reverse().find((event) => /approv/i.test(event.label)) : undefined;

  const afterScore = noCoverNeeded ? evaluation.score : currentRevalidation?.afterScore ?? null;

  return (
    <div className="md-shell">
      <Header />

      {error && (
        <div className="panel" role="alert" style={{ padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
          <span>{error}</span>
          <button type="button" className="button ghost" onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}

      <div className="panel md-section" style={{ padding: '1.25rem' }}>
        <div className="md-summary">
          <span className="avatar" aria-hidden="true">
            AR
          </span>
          <div>
            <p className="md-summary-name">{REQUESTER_NAME}</p>
            <p className="muted">
              {WARD_NAME} &middot; {evaluation.startDate} &ndash; {evaluation.endDate}
            </p>
          </div>
          {noCoverNeeded && <span className="badge">No cover required</span>}
        </div>
      </div>

      <div className="panel md-section" style={{ padding: '1.25rem' }}>
        <div className="md-transform">
          <div className="panel md-score-card" data-tone="before">
            <span className="md-score-label">Before cover</span>
            <span className="md-score-value">{evaluation.score}</span>
            <span className="md-score-sub">{evaluation.feasible ? 'Feasible' : 'Senior coverage ✕'}</span>
          </div>
          <div className="md-transform-arrow" aria-hidden="true">
            <ArrowRight size={28} />
          </div>
          <div className="panel md-score-card" data-tone="after">
            <span className="md-score-label">{noCoverNeeded ? 'Confirmed' : 'After revalidation'}</span>
            <span className="md-score-value" data-pending={afterScore === null}>
              {afterScore ?? 'Pending'}
            </span>
            <span className="md-score-sub">
              {noCoverNeeded
                ? 'No cover needed'
                : currentRevalidation
                  ? currentRevalidation.valid
                    ? 'All checks pass'
                    : 'Checks incomplete'
                  : 'Awaiting resolution'}
            </span>
          </div>
        </div>
      </div>

      {!noCoverNeeded && (
        <div className="panel md-section" style={{ padding: '1.25rem' }}>
          <p className="md-section-title">
            <ShieldAlert size={16} aria-hidden="true" />
            Proposed resolution
          </p>
          {!currentCoverRequest && <p className="muted">No cover has been requested for this evaluation yet.</p>}
          {currentCoverRequest && (
            <>
              <p className="md-consent-row">
                {consentGiven ? <CheckCircle2 size={15} aria-hidden="true" /> : <ClipboardList size={15} aria-hidden="true" />}
                {currentCoverRequest.recipientName}
                {currentCoverRequest.status === 'sent' && ' — request sent, awaiting response'}
                {currentCoverRequest.status === 'declined' && ' — declined'}
                {consentGiven && ' — accepted'}
              </p>
              {currentCoverRequest.status === 'declined' && (
                <p className="muted">This request was declined and cannot be revalidated. No approval action is available for it.</p>
              )}
            </>
          )}

          {currentRevalidation && (
            <div className="md-checklist">
              {currentRevalidation.checks.map((check) => (
                <div key={check.ruleId} className="md-check" data-ok={check.passed}>
                  {check.passed ? <CheckCircle2 size={15} aria-hidden="true" /> : <XCircle size={15} aria-hidden="true" />}
                  {check.label}
                </div>
              ))}
              <div className="md-check" data-ok={consentGiven}>
                {consentGiven ? <CheckCircle2 size={15} aria-hidden="true" /> : <XCircle size={15} aria-hidden="true" />}
                Staff consent
              </div>
            </div>
          )}
        </div>
      )}

      {audit.length > 0 && (
        <div className="panel md-section" style={{ padding: '1.25rem' }}>
          <p className="md-section-title">Audit timeline</p>
          <AuditTimeline events={audit} />
        </div>
      )}

      <div className="panel" style={{ padding: '1.25rem' }}>
        <div className="md-approve-row">
          {approved ? (
            <div className="md-approved-badge">
              <ShieldCheck size={18} aria-hidden="true" style={{ color: 'var(--teal)' }} />
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--ink)' }}>Approved</p>
                {approvedEvent && <p className="muted" style={{ margin: 0 }}>{formatTime(approvedEvent.at)}</p>}
              </div>
            </div>
          ) : (
            <p className="md-approve-hint">
              {canApprove
                ? 'This decision is a human judgment call — approving records your sign-off.'
                : 'Approval unlocks once consent and a valid revalidation are recorded for this request.'}
            </p>
          )}
          <button type="button" className="button primary" disabled={!canApprove} onClick={() => void approve()}>
            {isBusy ? <Loader2 size={15} className="md-spin" aria-hidden="true" /> : <ShieldCheck size={15} aria-hidden="true" />}
            {approved ? 'Approved' : 'Approve request'}
          </button>
        </div>
        <p className="md-disclaimer">
          Staffing rules shown here are synthetic demo rules built for this prototype, not real hospital policy or clinical guidance.
        </p>
      </div>
    </div>
  );
}

function AuditTimeline({ events }: { events: AuditEvent[] }) {
  return (
    <ol className="md-audit">
      {events.map((event) => (
        <li key={event.id} className="md-audit-item">
          <span className="md-audit-time">{formatTime(event.at)}</span>
          <span className="md-audit-label">{event.label}</span>
        </li>
      ))}
    </ol>
  );
}

function Header() {
  return (
    <div className="md-header">
      <p className="eyebrow">Manager dashboard</p>
      <h1 className="md-title">Leave request review</h1>
      <p className="md-subtitle">Human-in-the-loop approval for CoverAssist resolutions.</p>
    </div>
  );
}
