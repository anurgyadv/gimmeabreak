'use client';

import { forwardRef, type KeyboardEvent } from 'react';
import { CheckCircle2, CircleCheck, CircleDot, TriangleAlert } from 'lucide-react';
import type { FeasibilityStatus, LeaveDayFeasibility } from '@/lib/types';
import { formatDateFull, isoToDayNumber } from './dateUtils';

const STATUS_META: Record<
  FeasibilityStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  easy: { label: 'Easy', icon: CheckCircle2, className: 'is-easy' },
  good: { label: 'Good', icon: CircleCheck, className: 'is-good' },
  'cover-needed': { label: 'Cover needed', icon: CircleDot, className: 'is-cover-needed' },
  difficult: { label: 'Difficult', icon: TriangleAlert, className: 'is-difficult' },
};

interface DayCellProps {
  date: string;
  feasibility?: LeaveDayFeasibility;
  isPreview: boolean;
  isPreviewBoundary: boolean;
  isCommitted: boolean;
  isCommittedStart: boolean;
  isCommittedEnd: boolean;
  isPendingStart: boolean;
  disabled: boolean;
  tabIndex: number;
  onPointerDown: (date: string) => void;
  onPointerEnter: (date: string) => void;
  onActivate: (date: string) => void;
  onKeyNav: (date: string, key: string) => void;
}

const DayCell = forwardRef<HTMLButtonElement, DayCellProps>(function DayCell(
  {
    date,
    feasibility,
    isPreview,
    isPreviewBoundary,
    isCommitted,
    isCommittedStart,
    isCommittedEnd,
    isPendingStart,
    disabled,
    tabIndex,
    onPointerDown,
    onPointerEnter,
    onActivate,
    onKeyNav,
  },
  ref,
) {
  const day = isoToDayNumber(date);
  const meta = feasibility ? STATUS_META[feasibility.status] : undefined;
  const Icon = meta?.icon;

  const stateClasses = [
    'ca-day',
    meta?.className ?? '',
    isPreview ? 'ca-day--preview' : '',
    isPreviewBoundary ? 'ca-day--preview-boundary' : '',
    isCommitted ? 'ca-day--committed' : '',
    isCommittedStart ? 'ca-day--range-start' : '',
    isCommittedEnd ? 'ca-day--range-end' : '',
    isPendingStart ? 'ca-day--pending-start' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const ariaLabelParts = [formatDateFull(date)];
  if (feasibility) {
    ariaLabelParts.push(`feasibility score ${feasibility.score}`, meta!.label);
    if (feasibility.primaryReason) ariaLabelParts.push(feasibility.primaryReason);
  }
  if (isPendingStart) ariaLabelParts.push('selected as start, choose an end date');

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (disabled) return;
      onActivate(date);
      return;
    }
    if (
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown'
    ) {
      e.preventDefault();
      onKeyNav(date, e.key);
    }
  }

  return (
    <button
      ref={ref}
      type="button"
      className={stateClasses}
      disabled={disabled}
      tabIndex={tabIndex}
      aria-pressed={isCommitted || isPendingStart}
      aria-label={ariaLabelParts.join(', ')}
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        onPointerDown(date);
      }}
      onPointerEnter={() => onPointerEnter(date)}
      onKeyDown={handleKeyDown}
    >
      <span className="ca-day__num">{day}</span>
      {feasibility ? (
        <>
          <span className="ca-day__score">{feasibility.score}</span>
          <span className="ca-day__label">
            {Icon ? <Icon aria-hidden="true" size={12} /> : null}
            {meta!.label}
          </span>
          {feasibility.primaryReason ? (
            <span className="ca-day__reason">{feasibility.primaryReason}</span>
          ) : (
            <span className="ca-day__reason ca-day__reason--empty" aria-hidden="true" />
          )}
        </>
      ) : (
        <span className="ca-day__label ca-day__label--muted">…</span>
      )}
    </button>
  );
});

export default DayCell;
