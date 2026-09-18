'use client';

import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, CheckCircle2, Loader2, Send, X, XCircle } from 'lucide-react';
import { useDemo } from '@/lib/demo-context';
import type { CoverOption, CoverRequest, NoteTone } from '@/lib/types';
import CoverOptionCard from './CoverOptionCard';
import NoteComposer from './NoteComposer';
import './cover.css';

export interface CoverFlowProps {
  open: boolean;
  onClose: () => void;
}

type Stage = 'list' | 'compose';

export default function CoverFlow({ open, onClose }: CoverFlowProps) {
  const { evaluation, options, coverRequest, busy, error, teamsUnavailable, loadOptions, evaluate, requestCover, rephrase, clearError } =
    useDemo();

  const [stage, setStage] = useState<Stage>('list');
  const [selectedOption, setSelectedOption] = useState<CoverOption | null>(null);
  const [draftNote, setDraftNote] = useState('');

  useEffect(() => {
    if (open && options.length === 0 && !busy) {
      void loadOptions();
    }
  }, [open, options.length, busy, loadOptions]);

  useEffect(() => {
    setStage('list');
    setSelectedOption(null);
    setDraftNote('');
  }, [evaluation?.evaluationId]);

  const currentRequest = useMemo(
    () => (coverRequest && coverRequest.leaveEvaluationId === evaluation?.evaluationId ? coverRequest : null),
    [coverRequest, evaluation?.evaluationId],
  );

  const isSending = busy !== null;
  const requestLocked = currentRequest?.status === 'sent' || currentRequest?.status === 'accepted' || currentRequest?.status === 'revalidated';
  const canSend = !isSending && !requestLocked;

  function handleAsk(option: CoverOption) {
    setSelectedOption(option);
    setDraftNote('');
    setStage('compose');
  }

  async function handleUseAlternateDates() {
    await evaluate('2026-11-23', '2026-11-25');
    onClose();
  }

  async function handleRephrase(text: string, tone: NoteTone) {
    return rephrase(text, tone);
  }

  async function handleSend() {
    if (!selectedOption || !canSend) return;
    await requestCover(selectedOption.id, draftNote);
  }

  function handleOpenChange(next: boolean) {
    if (!next) onClose();
  }

  const rangeLabel = evaluation ? `${evaluation.startDate} – ${evaluation.endDate}` : 'your selected dates';

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="cf-overlay" />
        <Dialog.Content className="panel cf-content" aria-describedby="cf-subtitle">
          <div className="cf-body">
            <div className="cf-header">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <p className="eyebrow">Resolve cover</p>
                  <Dialog.Title className="cf-title">Make {rangeLabel} work</Dialog.Title>
                  <Dialog.Description id="cf-subtitle" className="cf-subtitle">
                    Ranked strategies based on the current roster evaluation.
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button type="button" className="button ghost" aria-label="Close">
                    <X size={16} aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>

              <div className="cf-status-line" role="status" aria-live="polite" data-busy={isSending}>
                {isSending && <Loader2 size={14} className="cf-spin" aria-hidden="true" />}
                {isSending ? 'Working…' : ' '}
              </div>
            </div>

            {error && (
              <div className="cf-error" role="alert">
                <span>{error}</span>
                <button type="button" onClick={clearError}>
                  Dismiss
                </button>
              </div>
            )}

            <AnimatePresence mode="wait">
              {stage === 'list' || !selectedOption ? (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {currentRequest && currentRequest.status !== 'draft' ? (
                    <RequestStatus request={currentRequest} teamsUnavailable={teamsUnavailable} />
                  ) : null}

                  {options.length === 0 && !isSending && (
                    <div className="cf-empty">
                      <p>No resolution strategies loaded yet.</p>
                    </div>
                  )}

                  {options.length > 0 && (
                    <ul className="cf-options" aria-label="Ranked cover strategies">
                      {[...options]
                        .sort((a, b) => a.rank - b.rank)
                        .map((option) => (
                          <CoverOptionCard
                            key={option.id}
                            option={option}
                            onAsk={handleAsk}
                            onUseAlternateDates={handleUseAlternateDates}
                            askDisabled={isSending || requestLocked}
                          />
                        ))}
                    </ul>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="compose"
                  className="cf-compose"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <button type="button" className="button ghost cf-back" onClick={() => setStage('list')}>
                    <ArrowLeft size={15} aria-hidden="true" />
                    Back to strategies
                  </button>

                  <p className="cf-compose-target">
                    Requesting cover from <strong>{selectedOption.clinicianName}</strong>
                  </p>

                  {currentRequest && currentRequest.status !== 'draft' && (
                    <RequestStatus request={currentRequest} teamsUnavailable={teamsUnavailable} />
                  )}

                  {!requestLocked && (
                    <>
                      <NoteComposer
                        draftNote={draftNote}
                        onDraftChange={setDraftNote}
                        onRephrase={handleRephrase}
                        disabled={isSending}
                      />

                      <div className="cf-send-row">
                        <span className="cf-send-hint">
                          No formal leave reason is sent &mdash; only the optional note above.
                        </span>
                        <button type="button" className="button primary" disabled={!canSend} onClick={handleSend}>
                          <Send size={15} aria-hidden="true" />
                          {teamsUnavailable ? 'Send to cover inbox (simulated)' : 'Send via Teams (simulated)'}
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RequestStatus({
  request,
  teamsUnavailable,
}: {
  request: CoverRequest;
  teamsUnavailable: boolean;
}) {
  const state = request.status;
  return (
    <div className="cf-confirmation" data-state={state}>
      <div className="cf-confirmation-head">
        {state === 'declined' ? <XCircle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
        {state === 'sent' && `Request sent to ${request.recipientName}`}
        {state === 'accepted' && `${request.recipientName} accepted`}
        {state === 'revalidated' && `${request.recipientName} accepted — roster revalidated`}
        {state === 'declined' && `${request.recipientName} declined`}
      </div>
      {request.personalNote && <p className="cf-option-meta">&ldquo;{request.personalNote}&rdquo;</p>}
      <div className="cf-confirmation-actions">
        <Link className="button secondary" href="/teams-preview">
          {teamsUnavailable ? 'View cover inbox' : 'View in Teams preview'}
        </Link>
        {(state === 'accepted' || state === 'revalidated') && (
          <Link className="button ghost" href="/manager">
            View manager dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
