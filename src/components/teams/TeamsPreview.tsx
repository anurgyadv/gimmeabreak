'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Loader2,
  MessageCircleQuestion,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  SquareArrowOutUpRight,
  XCircle,
} from 'lucide-react';
import { useDemo } from '@/lib/demo-context';
import './teams.css';

const REQUESTER_NAME = 'Dr Anurag Rao';
const WARD_NAME = 'General Medicine';
const SHIFT_LABEL = 'Day · 08:00–16:00';
const DEEP_LINK_HREF = '/planner?host=teams&subEntityId=leave-eval-1820';

const SIMULATED_REPLY =
  'This is a simulated response — in production this would route to a live conversation in Microsoft Teams.';

export default function TeamsPreview() {
  const { evaluation, coverRequest, revalidation, options, teamsUnavailable, respond, revalidate, busy } = useDemo();
  const [askOpen, setAskOpen] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState('');
  const [asked, setAsked] = useState(false);

  const isBusy = busy !== null;

  if (!coverRequest) {
    return (
      <div className="tp-shell">
        <HostHeader unavailable={teamsUnavailable} />
        <div className="tp-empty panel">
          <p>No cover request has been sent yet.</p>
          <p className="muted">Resolve a leave evaluation from the planner to see the {teamsUnavailable ? 'cover inbox' : 'Teams'} preview.</p>
          <Link className="button primary" href="/planner">
            Go to planner
          </Link>
        </div>
      </div>
    );
  }

  const matchedOption = options.find((option) => option.id === coverRequest.optionId);
  const currentRevalidation = revalidation && revalidation.coverRequestId === coverRequest.id ? revalidation : null;
  const restCompliant = matchedOption ? matchedOption.restCompliant : true;
  const overtimeHours = matchedOption ? matchedOption.overtimeHours : 0;
  const dateLabel = evaluation ? `${evaluation.startDate} – ${evaluation.endDate}` : 'the requested dates';

  return (
    <div className="tp-shell">
      <HostHeader unavailable={teamsUnavailable} />

      <div className="tp-persona">
        <span className="avatar" aria-hidden="true">
          SL
        </span>
        <div className="tp-persona-meta">
          <p className="tp-persona-name">Dr Sarah Lee</p>
          <p className="tp-persona-sub">General Medicine · Senior clinician</p>
        </div>
      </div>

      <div className="tp-conversation">
        <div className="tp-bubble">
          <span className="tp-bubble-app">
            <Sparkles size={13} aria-hidden="true" />
            CoverAssist
          </span>

          <h2 className="tp-card-title">Shift cover request</h2>
          <p className="tp-card-body">
            {REQUESTER_NAME} is looking for cover on {dateLabel}.
          </p>

          <div className="tp-facts">
            <Fact label="Ward" value={WARD_NAME} />
            <Fact label="Shift" value={SHIFT_LABEL} />
            <Fact label="Overtime" value={overtimeHours === 0 ? 'None' : `${overtimeHours}h`} />
            <Fact label="Rest check" value={restCompliant ? 'Satisfied' : 'Needs review'} />
          </div>

          {coverRequest.personalNote && (
            <div>
              <p className="tp-note-label">Personal note</p>
              <p className="tp-note-text">&ldquo;{coverRequest.personalNote}&rdquo;</p>
            </div>
          )}

          {coverRequest.status === 'sent' && (
            <div className="tp-actions">
              <button type="button" className="button primary" disabled={isBusy} onClick={() => void respond('accepted')}>
                {isBusy ? <Loader2 size={15} className="tp-spin" aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
                Accept
              </button>
              <button type="button" className="button secondary" disabled={isBusy} onClick={() => void respond('declined')}>
                <XCircle size={15} aria-hidden="true" />
                Decline
              </button>
              <button type="button" className="button ghost" onClick={() => setAskOpen((value) => !value)}>
                <MessageCircleQuestion size={15} aria-hidden="true" />
                Ask a question
              </button>
            </div>
          )}

          {coverRequest.status !== 'sent' && (
            <div className="tp-actions">
              <button type="button" className="button ghost" onClick={() => setAskOpen((value) => !value)}>
                <MessageCircleQuestion size={15} aria-hidden="true" />
                Ask a question
              </button>
            </div>
          )}

          <p className="tp-caption">
            <ShieldCheck size={13} aria-hidden="true" />
            Prototype of the Teams Adaptive Card workflow.
          </p>
        </div>

        {askOpen && (
          <div className="tp-support" role="group" aria-label="Ask a question (simulated)">
            <span className="tp-support-label">Simulated support thread</span>
            <textarea
              className="tp-textarea"
              rows={2}
              placeholder="Type a question for Sarah…"
              value={draftQuestion}
              onChange={(event) => setDraftQuestion(event.target.value)}
            />
            <div className="tp-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setAsked(true)}
                disabled={draftQuestion.trim().length === 0}
              >
                Send question (simulated)
              </button>
            </div>
            {asked && <p className="muted">{SIMULATED_REPLY}</p>}
          </div>
        )}

        {coverRequest.status === 'accepted' && (
          <div className="tp-panel" data-tone="positive">
            <div className="tp-panel-head">
              <CheckCircle2 size={16} aria-hidden="true" />
              Sarah accepted
            </div>
            <p className="muted">Revalidate the roster to confirm the leave is now feasible.</p>
            <div className="tp-actions">
              <button type="button" className="button primary" disabled={isBusy} onClick={() => void revalidate()}>
                {isBusy ? <Loader2 size={15} className="tp-spin" aria-hidden="true" /> : <ShieldCheck size={15} aria-hidden="true" />}
                Revalidate roster
              </button>
            </div>
          </div>
        )}

        {coverRequest.status === 'revalidated' && currentRevalidation && (
          <div className="tp-panel" data-tone="positive">
            <div className="tp-panel-head">
              <ShieldCheck size={16} aria-hidden="true" />
              Roster revalidated
            </div>
            <p className="muted">
              Feasibility {currentRevalidation.beforeScore} &rarr; {currentRevalidation.afterScore}
            </p>
            <ul className="tp-checks">
              {currentRevalidation.checks.map((check) => (
                <li key={check.ruleId} className="tp-check">
                  {check.passed ? <CheckCircle2 size={14} aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
                  {check.label}
                </li>
              ))}
            </ul>
            <div className="tp-actions">
              <Link className="button primary" href="/manager">
                Continue to manager approval
              </Link>
              <Link className="button ghost" href="/planner">
                Back to planner
              </Link>
            </div>
          </div>
        )}

        {coverRequest.status === 'declined' && (
          <div className="tp-panel" data-tone="warn">
            <div className="tp-panel-head">
              <XCircle size={16} aria-hidden="true" />
              Sarah declined
            </div>
            <p className="muted">This request cannot be revalidated. Choose another way forward from the planner.</p>
            <div className="tp-actions">
              <Link className="button primary" href="/planner">
                Return to planner
              </Link>
              <Link className="button secondary" href="/planner">
                Try alternative
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="tp-deep-link">
        <span className="muted">Adaptive Card action: Open Leave Planner</span>
        <Link className="button secondary" href={DEEP_LINK_HREF}>
          <SquareArrowOutUpRight size={15} aria-hidden="true" />
          Open in Teams host
        </Link>
      </div>
    </div>
  );
}

function HostHeader({ unavailable }: { unavailable: boolean }) {
  return (
    <div className="tp-host" data-unavailable={unavailable}>
      <div className="tp-host-left">
        <MessagesSquare size={16} aria-hidden="true" />
        {unavailable ? 'Cover Inbox' : 'Microsoft Teams'}
      </div>
      <span className="tp-host-badge">{unavailable ? 'Teams unavailable · internal fallback' : 'Simulated host'}</span>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="tp-fact-label">{label}</p>
      <p className="tp-fact-value">{value}</p>
    </div>
  );
}
