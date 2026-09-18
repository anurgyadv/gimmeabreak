'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LeaveDayFeasibility } from '@/lib/types';
import DayCell from './DayCell';
import { useRangeSelection } from './useRangeSelection';
import {
  DAYS_IN_MONTH,
  MAX_DATE,
  MIN_DATE,
  addDays,
  dayNumberToISO,
  formatRangeShort,
  isInRange,
  isValidNovemberISO,
  leadingBlankCount,
  normalizeRange,
} from './dateUtils';

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TRAILING_BLANKS = (() => {
  const total = leadingBlankCount() + DAYS_IN_MONTH;
  const remainder = total % 7;
  return remainder === 0 ? 0 : 7 - remainder;
})();

interface CalendarProps {
  calendar: LeaveDayFeasibility[];
  committedRange: [string, string] | null;
  disabled: boolean;
  onCommitRange: (start: string, end: string) => void;
}

export default function Calendar({
  calendar,
  committedRange,
  disabled,
  onCommitRange,
}: CalendarProps) {
  const feasibilityMap = useMemo(() => {
    const map = new Map<string, LeaveDayFeasibility>();
    for (const day of calendar) map.set(day.date, day);
    return map;
  }, [calendar]);

  const { previewRange, pendingStart, handlePointerDown, handlePointerEnter, selectViaKeyboard, cancelPending } =
    useRangeSelection(onCommitRange, disabled);

  const [focusedDate, setFocusedDate] = useState(committedRange?.[0] ?? MIN_DATE);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [inputStart, setInputStart] = useState(committedRange?.[0] ?? '');
  const [inputEnd, setInputEnd] = useState(committedRange?.[1] ?? '');

  useEffect(() => {
    setInputStart(committedRange?.[0] ?? '');
    setInputEnd(committedRange?.[1] ?? '');
    cancelPending();
  }, [committedRange]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && pendingStart) cancelPending();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pendingStart, cancelPending]);

  function handleKeyNav(date: string, key: string) {
    const delta = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : key === 'ArrowUp' ? -7 : 7;
    const target = addDays(date, delta);
    if (!target) return;
    setFocusedDate(target);
    buttonRefs.current[target]?.focus();
  }

  function commitFromInputs(nextStart: string, nextEnd: string) {
    if (!isValidNovemberISO(nextStart) || !isValidNovemberISO(nextEnd)) return;
    const [start, end] = normalizeRange(nextStart, nextEnd);
    onCommitRange(start, end);
  }

  const cells: Array<{ key: string; date: string | null }> = [];
  for (let i = 0; i < leadingBlankCount(); i++) cells.push({ key: `lead-${i}`, date: null });
  for (let day = 1; day <= DAYS_IN_MONTH; day++) {
    const date = dayNumberToISO(day);
    cells.push({ key: date, date });
  }
  for (let i = 0; i < TRAILING_BLANKS; i++) cells.push({ key: `trail-${i}`, date: null });

  return (
    <div className="ca-calendar">
      <div className="ca-calendar__head">
        <div>
          <h2 className="ca-calendar__title">November 2026</h2>
          <p className="muted ca-calendar__note">Click your first and last day, or drag to explore.</p>
        </div>
        {pendingStart ? (
          <p className="ca-calendar__hint" role="status">
            Start set to {formatRangeShort(pendingStart, pendingStart)}. Choose an end date, or press Escape to
            cancel.
          </p>
        ) : null}
      </div>

      <div className="ca-calendar__weekdays" aria-hidden="true">
        {WEEKDAY_HEADERS.map((w) => (
          <div key={w} className="ca-calendar__weekday">
            {w}
          </div>
        ))}
      </div>

      <div className="ca-calendar__grid" role="group" aria-label="November 2026 leave feasibility calendar">
        {cells.map((cell) => {
          if (!cell.date) return <div key={cell.key} className="ca-day ca-day--blank" aria-hidden="true" />;

          const date = cell.date;
          const isPreview = previewRange ? isInRange(date, previewRange[0], previewRange[1]) : false;
          const isPreviewBoundary = previewRange ? date === previewRange[0] || date === previewRange[1] : false;
          const isCommitted = committedRange ? isInRange(date, committedRange[0], committedRange[1]) : false;

          return (
            <DayCell
              key={cell.key}
              ref={(el) => {
                buttonRefs.current[date] = el;
              }}
              date={date}
              feasibility={feasibilityMap.get(date)}
              isPreview={isPreview}
              isPreviewBoundary={isPreviewBoundary}
              isCommitted={isCommitted}
              isCommittedStart={committedRange ? date === committedRange[0] : false}
              isCommittedEnd={committedRange ? date === committedRange[1] : false}
              isPendingStart={pendingStart === date}
              disabled={disabled}
              tabIndex={date === focusedDate ? 0 : -1}
              onPointerDown={(d) => {
                setFocusedDate(d);
                handlePointerDown(d);
              }}
              onPointerEnter={handlePointerEnter}
              onActivate={selectViaKeyboard}
              onKeyNav={handleKeyNav}
            />
          );
        })}
      </div>

      <div className="ca-calendar__legend">
        <span className="ca-legend-item is-easy">Easy</span>
        <span className="ca-legend-item is-good">Good</span>
        <span className="ca-legend-item is-cover-needed">Cover needed</span>
        <span className="ca-legend-item is-difficult">Difficult</span>
      </div>

      <fieldset className="ca-calendar__inputs" disabled={disabled}>
        <legend className="ca-eyebrow eyebrow">Choose dates directly</legend>
        <label className="ca-field">
          <span>Start date</span>
          <input
            type="date"
            min={MIN_DATE}
            max={MAX_DATE}
            value={inputStart}
            onChange={(e) => {
              const next = e.target.value;
              setInputStart(next);
              if (next && inputEnd) commitFromInputs(next, inputEnd);
            }}
          />
        </label>
        <label className="ca-field">
          <span>End date</span>
          <input
            type="date"
            min={MIN_DATE}
            max={MAX_DATE}
            value={inputEnd}
            onChange={(e) => {
              const next = e.target.value;
              setInputEnd(next);
              if (inputStart && next) commitFromInputs(inputStart, next);
            }}
          />
        </label>
      </fieldset>
    </div>
  );
}
