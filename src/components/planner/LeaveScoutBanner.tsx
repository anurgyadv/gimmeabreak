'use client';

import { Sparkles } from 'lucide-react';
import type { LeaveWindow } from '@/lib/types';

const SCOUT_START = '2026-11-23';
const SCOUT_END = '2026-11-25';

interface LeaveScoutBannerProps {
  windows: LeaveWindow[];
  busy: string | null;
  onExplore: (start: string, end: string) => void;
}

export default function LeaveScoutBanner({ windows, busy, onExplore }: LeaveScoutBannerProps) {
  const match = windows.find((w) => w.startDate === SCOUT_START && w.endDate === SCOUT_END);

  return (
    <div className="ca-scout panel">
      <div className="ca-scout__icon" aria-hidden="true">
        <Sparkles size={20} />
      </div>
      <div className="ca-scout__body">
        <p className="ca-scout__eyebrow eyebrow">Leave Scout</p>
        <p className="ca-scout__title">23–25 November looks like a strong window</p>
        <p className="muted ca-scout__subtitle">
          {match
            ? match.explanation
            : 'A quick scan suggests senior coverage stays comfortably above minimum across this window.'}
        </p>
      </div>
      <div className="ca-scout__action">
        {match ? <span className="badge ca-status-badge is-easy">{match.score}</span> : null}
        <button
          type="button"
          className="button primary"
          onClick={() => onExplore(SCOUT_START, SCOUT_END)}
          disabled={busy !== null}
        >
          Explore these dates
        </button>
      </div>
    </div>
  );
}
