'use client';

import { useState } from 'react';
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, User, CalendarRange } from 'lucide-react';
import type { CoverOption } from '@/lib/types';

interface CoverOptionCardProps {
  option: CoverOption;
  onAsk?: (option: CoverOption) => void;
  onUseAlternateDates?: (option: CoverOption) => void;
  askDisabled?: boolean;
}

const ALTERNATE_LABEL = '23–25 November';

export default function CoverOptionCard({ option, onAsk, onUseAlternateDates, askDisabled }: CoverOptionCardProps) {
  const [impactOpen, setImpactOpen] = useState(false);
  const isAlternate = option.strategy === 'alternate-dates';
  const isSwapOrReplacement = option.strategy === 'swap' || option.strategy === 'replacement';
  const hasDownstreamConflict = Boolean(option.downstreamConflict);
  const canAsk = isSwapOrReplacement && !hasDownstreamConflict && Boolean(onAsk);

  return (
    <li className="cf-option" data-recommended={option.recommended} data-blocked={hasDownstreamConflict}>
      <div className="cf-option-head">
        <span className="cf-option-name">
          {isAlternate ? <CalendarRange size={16} aria-hidden="true" /> : <User size={16} aria-hidden="true" />}
          <span className="cf-rank">{option.rank}.</span>
          {isAlternate ? `Move leave to ${ALTERNATE_LABEL}` : option.clinicianName ?? 'Candidate'}
        </span>
        {option.recommended && <span className="badge">Best fit</span>}
      </div>

      <ul className="cf-checks">
        {isAlternate ? (
          <>
            <li className="cf-check" data-ok="true">
              <CheckCircle2 size={15} aria-hidden="true" />
              No cover required
            </li>
            <li className="cf-check" data-ok="true">
              <CheckCircle2 size={15} aria-hidden="true" />
              No roster changes
            </li>
          </>
        ) : (
          <>
            <li className="cf-check" data-ok={option.restCompliant}>
              {option.restCompliant ? <CheckCircle2 size={15} aria-hidden="true" /> : <AlertTriangle size={15} aria-hidden="true" />}
              {option.restCompliant ? 'Rest compliant' : 'Rest conflict'}
            </li>
            <li className="cf-check" data-ok={option.overtimeHours === 0}>
              {option.overtimeHours === 0 ? <CheckCircle2 size={15} aria-hidden="true" /> : <AlertTriangle size={15} aria-hidden="true" />}
              {option.overtimeHours === 0 ? 'No overtime' : `${option.overtimeHours}h overtime`}
            </li>
            <li className="cf-check" data-ok={!hasDownstreamConflict}>
              {hasDownstreamConflict ? <AlertTriangle size={15} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
              {hasDownstreamConflict ? 'Downstream coverage issue' : 'No downstream coverage issue'}
            </li>
          </>
        )}
      </ul>

      <p className="cf-option-meta">{option.explanation}</p>
      {!isAlternate && (
        <p className="cf-option-meta">
          {option.rosterChanges} roster change{option.rosterChanges === 1 ? '' : 's'}
        </p>
      )}

      <div className="cf-option-actions">
        {isAlternate && (
          <button type="button" className="button primary" onClick={() => onUseAlternateDates?.(option)}>
            Use these dates
          </button>
        )}
        {canAsk && (
          <button type="button" className="button primary" disabled={askDisabled} onClick={() => onAsk?.(option)}>
            Ask {option.clinicianName?.split(' ')[0] ?? 'candidate'}
          </button>
        )}
        {hasDownstreamConflict && (
          <button
            type="button"
            className="button secondary"
            aria-expanded={impactOpen}
            onClick={() => setImpactOpen((value) => !value)}
          >
            {impactOpen ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
            See impact
          </button>
        )}
      </div>

      {hasDownstreamConflict && impactOpen && option.downstreamConflict && (
        <div className="cf-impact">
          <div className="cf-impact-row">
            <span className="cf-impact-day">
              <CheckCircle2 size={15} aria-hidden="true" style={{ color: 'var(--teal)' }} />
              Selected day &mdash; solved
            </span>
            <span className="cf-impact-arrow" aria-hidden="true">
              &rarr;
            </span>
            <span className="cf-impact-day">
              <AlertTriangle size={15} aria-hidden="true" />
              {option.downstreamConflict.date} &mdash; conflict
            </span>
          </div>
          <p className="cf-impact-note">{option.downstreamConflict.explanation}</p>
          <p className="cf-impact-note">This candidate cannot be requested while this conflict remains.</p>
        </div>
      )}
    </li>
  );
}
