'use client';

import { useCallback, useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { AlertCircle, CalendarDays, FlaskConical } from 'lucide-react';
import { useDemo } from '@/lib/demo-context';
import CoverFlow from '@/components/cover/CoverFlow';
import Calendar from './Calendar';
import CoveragePanel from './CoveragePanel';
import AlternativeWindows from './AlternativeWindows';
import AssistantPanel from './AssistantPanel';
import LeaveScoutBanner from './LeaveScoutBanner';
import WhyDialog from './WhyDialog';
import './planner.css';

export default function Planner() {
  const {
    ready,
    busy,
    error,
    me,
    calendar,
    windows,
    options,
    evaluation,
    coverRequest,
    revalidation,
    approved,
    evaluate,
    findWindows,
    loadOptions,
    revalidate,
    clearError,
  } = useDemo();

  const [committedRange, setCommittedRange] = useState<[string, string] | null>(evaluation ? [evaluation.startDate, evaluation.endDate] : null);
  const [pendingEval, setPendingEval] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [coverFlowOpen, setCoverFlowOpen] = useState(false);

  useEffect(() => {
    setCommittedRange(evaluation ? [evaluation.startDate, evaluation.endDate] : null);
    if (!evaluation) { setWhyOpen(false); setCoverFlowOpen(false); }
  }, [evaluation]);

  const handleCommitRange = useCallback(
    async (start: string, end: string) => {
      setCommittedRange([start, end]);
      setPendingEval(true);
      try {
        await evaluate(start, end);
      } finally {
        setPendingEval(false);
      }
    },
    [evaluate],
  );

  const handleMakeThisWork = useCallback(async () => {
    await loadOptions();
    setCoverFlowOpen(true);
  }, [loadOptions]);

  const handleOpenWhy = useCallback(() => setWhyOpen(true), []);
  const handleRevalidate = useCallback(() => {
    void revalidate();
  }, [revalidate]);
  const handleFindWindows = useCallback(() => {
    void findWindows();
  }, [findWindows]);

  const matchesSelection = Boolean(
    evaluation && committedRange && evaluation.startDate === committedRange[0] && evaluation.endDate === committedRange[1],
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="ca-planner">
        <header className="ca-planner__header">
          <div>
            <h1 className="ca-planner__title">Your next break, made possible.</h1>
            <p className="ca-planner__subtitle">
              <CalendarDays aria-hidden="true" size={14} /> November 2026
              <span className="ca-planner__demo-tag">
                <FlaskConical aria-hidden="true" size={12} /> Synthetic demo data
              </span>
            </p>
          </div>
          {me ? (
            <div className="ca-planner__persona">
              <span className="avatar" aria-hidden="true">
                {me.initials}
              </span>
              <div>
                <p className="ca-planner__persona-name">{me.displayName}</p>
                <p className="muted">{me.wardName}</p>
              </div>
            </div>
          ) : null}
        </header>

        {error ? (
          <div className="ca-error-banner" role="alert">
            <AlertCircle aria-hidden="true" size={16} />
            <span>{error}</span>
            <button type="button" className="button ghost" onClick={clearError}>
              Dismiss
            </button>
          </div>
        ) : null}

        {!ready ? (
          <p className="muted ca-planner__loading">Loading CoverAssist…</p>
        ) : (
          <>
            <LeaveScoutBanner windows={windows} busy={busy} onExplore={handleCommitRange} />

            <div className="ca-planner__grid">
              <div className="ca-planner__calendar-col">
                <Calendar
                  calendar={calendar}
                  committedRange={committedRange}
                  disabled={busy !== null}
                  onCommitRange={handleCommitRange}
                />
              </div>

              <div className="ca-planner__side-col">
                <CoveragePanel
                  evaluation={evaluation}
                  committedRange={committedRange}
                  pendingEval={pendingEval}
                  coverRequest={coverRequest}
                  revalidation={revalidation}
                  approved={approved}
                  busy={busy}
                  onOpenWhy={handleOpenWhy}
                  onMakeThisWork={handleMakeThisWork}
                  onRevalidate={handleRevalidate}
                />

                <AlternativeWindows
                  windows={windows}
                  busy={busy}
                  committedRange={committedRange}
                  onFindWindows={handleFindWindows}
                  onUseWindow={handleCommitRange}
                />

                <AssistantPanel
                  evaluation={matchesSelection ? evaluation : null}
                  options={options}
                  busy={busy}
                  onWhy={handleOpenWhy}
                  onMakeThisWork={handleMakeThisWork}
                  onFindWindows={handleFindWindows}
                />
              </div>
            </div>
          </>
        )}

        <WhyDialog
          open={whyOpen}
          onClose={() => setWhyOpen(false)}
          evaluation={matchesSelection ? evaluation : null}
          onMakeThisWork={() => {
            setWhyOpen(false);
            void handleMakeThisWork();
          }}
          busy={busy}
        />

        <CoverFlow open={coverFlowOpen} onClose={() => setCoverFlowOpen(false)} />
      </div>
    </MotionConfig>
  );
}
