'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import type { LeaveEvaluation } from '@/lib/types';
import { formatRangeShort } from './dateUtils';

interface WhyDialogProps {
  open: boolean;
  onClose: () => void;
  evaluation: LeaveEvaluation | null;
  onMakeThisWork: () => void;
  busy: string | null;
}

export default function WhyDialog({ open, onClose, evaluation, onMakeThisWork, busy }: WhyDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="ca-dialog-overlay" />
        <Dialog.Content className="ca-dialog-content panel" aria-describedby="ca-why-description">
          <div className="ca-dialog-content__head">
            <Dialog.Title className="ca-dialog-title">
              {evaluation ? `Why ${formatRangeShort(evaluation.startDate, evaluation.endDate)} is difficult` : 'Why is this difficult?'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="button ghost ca-dialog-close" aria-label="Close">
                <X aria-hidden="true" size={18} />
              </button>
            </Dialog.Close>
          </div>

          {evaluation ? (
            <>
              <Dialog.Description id="ca-why-description" className="muted">
                {evaluation.summary}
              </Dialog.Description>

              {evaluation.limitingDate ? (
                <p className="ca-dialog-limiting">
                  <strong>{formatRangeShort(evaluation.limitingDate, evaluation.limitingDate)}</strong> is the limiting date
                </p>
              ) : null}

              {evaluation.violations.length > 0 ? (
                <ul className="ca-violation-list">
                  {evaluation.violations.map((v) => (
                    <li key={`${v.ruleId}-${v.date}`} className="ca-violation">
                      <XCircle aria-hidden="true" size={16} className="ca-violation__icon" />
                      <div>
                        <p className="ca-violation__name">{v.ruleName}</p>
                        <p className="muted">{v.explanation}</p>
                        {typeof v.required === 'number' ? (
                          <p className="ca-violation__stats">
                            Required {v.required} · Available {v.available ?? v.actual ?? '—'}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              <ul className="ca-checklist ca-checklist--evidence">
                {evaluation.metrics.map((m) => (
                  <li key={m.id} className={m.satisfied ? 'is-ok' : 'is-bad'}>
                    {m.satisfied ? (
                      <CheckCircle2 aria-hidden="true" size={14} />
                    ) : (
                      <XCircle aria-hidden="true" size={14} />
                    )}
                    {m.label}
                  </li>
                ))}
              </ul>

              {!evaluation.feasible ? (
                <button type="button" className="button primary ca-dialog-cta" onClick={onMakeThisWork} disabled={busy !== null}>
                  Make this work
                </button>
              ) : null}
            </>
          ) : (
            <p className="muted">Select a date range to see rule evidence.</p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
