'use client';

import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Circle, XCircle } from 'lucide-react';
import type { CoverageMetric, CoverRequest, LeaveEvaluation, RevalidationResult } from '@/lib/types';
import { formatRangeShort } from './dateUtils';
import { useAnimatedNumber } from './useAnimatedNumber';

const BASELINE_SCORE = 86;

interface CoveragePanelProps {
  evaluation: LeaveEvaluation | null;
  committedRange: [string, string] | null;
  pendingEval: boolean;
  coverRequest: CoverRequest | null;
  revalidation: RevalidationResult | null;
  approved: boolean;
  busy: string | null;
  onOpenWhy: () => void;
  onMakeThisWork: () => void;
  onRevalidate: () => void;
}

function MetricBar({ metric }: { metric: CoverageMetric }) {
  const scaleMax = metric.unit === 'percent' ? 100 : Math.max(metric.before, metric.required) * 1.3;
  const pct = Math.min(100, Math.max(0, (metric.after / scaleMax) * 100));
  const requiredPct = Math.min(100, Math.max(0, (metric.required / scaleMax) * 100));

  return (
    <div className="ca-metric">
      <div className="ca-metric__head">
        <span className="ca-metric__label">{metric.label}</span>
        <span className={`ca-metric__value ${metric.satisfied ? 'is-ok' : 'is-bad'}`}>
          {metric.before}
          {metric.unit === 'percent' ? '%' : ''} → {metric.after}
          {metric.unit === 'percent' ? '%' : ''}
          <span className="ca-metric__required"> / {metric.required} required</span>
          {metric.satisfied ? (
            <CheckCircle2 aria-hidden="true" size={14} />
          ) : (
            <XCircle aria-hidden="true" size={14} />
          )}
        </span>
      </div>
      <div className="ca-metric__track">
        <motion.div
          className={`ca-metric__fill ${metric.satisfied ? 'is-ok' : 'is-bad'}`}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.8 }}
        />
        <span className="ca-metric__required-marker" style={{ left: `${requiredPct}%` }} aria-hidden="true" />
      </div>
    </div>
  );
}

export default function CoveragePanel({
  evaluation,
  committedRange,
  pendingEval,
  coverRequest,
  revalidation,
  approved,
  busy,
  onOpenWhy,
  onMakeThisWork,
  onRevalidate,
}: CoveragePanelProps) {
  const isBusy = busy !== null;
  const matchesSelection =
    evaluation && committedRange && evaluation.startDate === committedRange[0] && evaluation.endDate === committedRange[1];

  const heroScore = revalidation?.valid ? revalidation.afterScore : matchesSelection ? evaluation!.score : BASELINE_SCORE;
  const animatedScore = useAnimatedNumber(heroScore, 700);

  const seniorViolation =
    matchesSelection && evaluation
      ? evaluation.violations.find((v) => v.date === evaluation.limitingDate) ?? evaluation.violations[0]
      : undefined;

  return (
    <section className="ca-panel panel" aria-live="polite">
      <div aria-live="polite" className="sr-only">
        {pendingEval
          ? 'Checking roster impact.'
          : revalidation?.valid
            ? `Roster revalidated. Feasibility is now ${revalidation.afterScore}.`
            : matchesSelection
              ? `Leave feasibility updated to ${evaluation!.score}. ${evaluation!.summary}`
              : ''}
      </div>

      <div className="ca-panel__eyebrow eyebrow">Coverage impact</div>

      {!committedRange && !matchesSelection ? (
        <>
          <p className="ca-panel__score-label muted">Typical day · unselected overview</p>
          <div className="ca-panel__score">{BASELINE_SCORE}</div>
          <p className="muted">Select dates on the calendar to see the real staffing impact for that period.</p>
          <div className="ca-static-metrics">
            <div className="ca-static-metric">
              <span>Department staffing</span>
              <strong>92%</strong>
            </div>
            <div className="ca-static-metric">
              <span>Senior coverage</span>
              <strong>2 / 2</strong>
            </div>
          </div>
        </>
      ) : pendingEval ? (
        <>
          <p className="ca-panel__score-label muted">
            {committedRange ? formatRangeShort(committedRange[0], committedRange[1]) : ''}
          </p>
          <div className="ca-panel__checking">
            <span className="ca-spinner" aria-hidden="true" />
            Checking roster…
          </div>
        </>
      ) : matchesSelection && evaluation ? (
        <>
          <div className="ca-panel__range-row">
            <p className="ca-panel__score-label">{formatRangeShort(evaluation.startDate, evaluation.endDate)}</p>
            <span className={`badge ca-status-badge is-${revalidation?.valid ? 'easy' : evaluation.status}`}>{revalidation?.valid ? 'Ready for approval' : evaluation.status.replace('-', ' ')}</span>
          </div>

          <div className="ca-panel__score" key={revalidation?.valid ? 'after' : 'before'}>
            {animatedScore}
          </div>
          {revalidation?.valid ? (
            <p className="muted ca-panel__before-after">
              Before cover: <strong>{evaluation.score}</strong> → After revalidation: <strong>{revalidation.afterScore}</strong>
            </p>
          ) : null}

          <p className="ca-panel__summary">{revalidation?.valid ? 'Sarah’s cover restores the roster. All required checks pass.' : evaluation.summary}</p>

          {seniorViolation && !revalidation?.valid ? (
            <div className="ca-hero-stat">
              <div>
                <span className="muted">Senior clinicians required</span>
                <strong>{seniorViolation.required ?? '—'}</strong>
              </div>
              <div>
                <span className="muted">Available after your leave</span>
                <strong>{seniorViolation.available ?? '—'}</strong>
              </div>
            </div>
          ) : null}

          <div className="ca-panel__metrics">
            {evaluation.metrics.map((m) => (
              <MetricBar key={m.id} metric={revalidation?.valid ? {...m, after: Math.max(m.after, m.required), satisfied: true} : m} />
            ))}
          </div>

          {!evaluation.feasible && !revalidation?.valid ? (
            <div className="ca-panel__actions">
              <button type="button" className="button secondary" onClick={onOpenWhy} disabled={isBusy}>
                <AlertTriangle aria-hidden="true" size={16} /> Why is this difficult?
              </button>
              <button type="button" className="button primary" onClick={onMakeThisWork} disabled={isBusy}>
                Make this work
              </button>
            </div>
          ) : (
            <p className="ca-panel__ok">
              <CheckCircle2 aria-hidden="true" size={16} /> {revalidation?.valid ? 'Coverage confirmed. Ready for a human decision.' : 'No cover action needed for these dates.'}
            </p>
          )}

          {coverRequest ? (
            <div className="ca-cover-status">
              <div className="ca-cover-status__row">
                <Circle aria-hidden="true" size={10} className={`ca-dot is-${coverRequest.status}`} />
                <span>
                  {coverRequest.status === 'sent' && `Waiting on ${coverRequest.recipientName} to respond`}
                  {coverRequest.status === 'accepted' && `${coverRequest.recipientName} accepted`}
                  {coverRequest.status === 'declined' && `${coverRequest.recipientName} declined — try another option`}
                  {coverRequest.status === 'revalidated' && `${coverRequest.recipientName} accepted and roster is revalidated`}
                  {coverRequest.status === 'draft' && 'Cover request drafted'}
                </span>
              </div>

              {coverRequest.status === 'accepted' && !revalidation?.valid ? (
                <button type="button" className="button primary" onClick={onRevalidate} disabled={isBusy}>
                  Revalidate roster
                </button>
              ) : null}

              {coverRequest.status === 'declined' ? (
                <button type="button" className="button secondary" onClick={onMakeThisWork} disabled={isBusy}>
                  Find another option
                </button>
              ) : null}

              {revalidation?.valid ? (
                <>
                  <ul className="ca-checklist">
                    {revalidation.checks.map((c) => (
                      <li key={c.ruleId} className={c.passed ? 'is-ok' : 'is-bad'}>
                        {c.passed ? <CheckCircle2 aria-hidden="true" size={14} /> : <XCircle aria-hidden="true" size={14} />}
                        {c.label}
                      </li>
                    ))}
                  </ul>
                  <a className="button secondary" href="/manager">
                    {approved ? 'View approval' : 'Review approval'} →
                  </a>
                </>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <p className="muted">Select dates on the calendar to see the staffing impact.</p>
      )}
    </section>
  );
}
