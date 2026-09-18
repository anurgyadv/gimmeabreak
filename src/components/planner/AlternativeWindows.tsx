'use client';

import { CheckCircle2, Search, ShieldAlert } from 'lucide-react';
import type { LeaveWindow } from '@/lib/types';
import { formatRangeShort } from './dateUtils';

interface AlternativeWindowsProps {
  windows: LeaveWindow[];
  busy: string | null;
  committedRange: [string, string] | null;
  onFindWindows: () => void;
  onUseWindow: (start: string, end: string) => void;
}

export default function AlternativeWindows({
  windows,
  busy,
  committedRange,
  onFindWindows,
  onUseWindow,
}: AlternativeWindowsProps) {
  const isBusy = busy !== null;

  return (
    <section className="ca-panel panel ca-alternatives">
      <div className="ca-panel__row">
        <div className="ca-panel__eyebrow eyebrow">Alternative windows</div>
        <button type="button" className="button ghost" onClick={onFindWindows} disabled={isBusy}>
          <Search aria-hidden="true" size={14} /> Find better dates
        </button>
      </div>

      {windows.length === 0 ? (
        <p className="muted">
          Ask CoverAssist to scan November for windows with strong staffing and no cover required.
        </p>
      ) : (
        <ul className="ca-window-list">
          {windows.map((w) => {
            const isActive = committedRange && committedRange[0] === w.startDate && committedRange[1] === w.endDate;
            return (
              <li key={`${w.startDate}-${w.endDate}`} className={`ca-window ${isActive ? 'is-active' : ''}`}>
                <div className="ca-window__head">
                  <span className="ca-window__range">{formatRangeShort(w.startDate, w.endDate)}</span>
                  <span className={`badge ca-status-badge is-${w.status}`}>{w.score}</span>
                </div>
                <p className="muted ca-window__explanation">{w.explanation}</p>
                <p className="ca-window__cover">
                  {w.coverRequired ? (
                    <>
                      <ShieldAlert aria-hidden="true" size={14} /> Cover required
                    </>
                  ) : (
                    <>
                      <CheckCircle2 aria-hidden="true" size={14} /> No cover required
                    </>
                  )}
                </p>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => onUseWindow(w.startDate, w.endDate)}
                  disabled={isBusy || Boolean(isActive)}
                >
                  {isActive ? 'Selected' : 'Use these dates'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
