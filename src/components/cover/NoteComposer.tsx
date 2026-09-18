'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { NoteTone } from '@/lib/types';

const TONES: { value: NoteTone; label: string }[] = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'brief', label: 'Brief' },
  { value: 'professional', label: 'Professional' },
];

interface NoteComposerProps {
  draftNote: string;
  onDraftChange: (value: string) => void;
  onRephrase: (text: string, tone: NoteTone) => Promise<string>;
  disabled?: boolean;
}

export default function NoteComposer({ draftNote, onDraftChange, onRephrase, disabled }: NoteComposerProps) {
  const [tone, setTone] = useState<NoteTone | null>(null);
  const [proposedText, setProposedText] = useState<string | null>(null);
  const [rephrasing, setRephrasing] = useState(false);
  const [rephraseError, setRephraseError] = useState<string | null>(null);

  async function handleTone(value: NoteTone) {
    if (rephrasing || disabled) return;
    setTone(value);
    setRephraseError(null);
    setRephrasing(true);
    try {
      const result = await onRephrase(draftNote, value);
      setProposedText(result);
    } catch {
      setRephraseError('Could not generate a suggestion. Try again.');
      setProposedText(null);
    } finally {
      setRephrasing(false);
    }
  }

  function useSuggestion() {
    if (!proposedText) return;
    onDraftChange(proposedText);
    setProposedText(null);
    setTone(null);
  }

  function keepMine() {
    setProposedText(null);
    setTone(null);
    setRephraseError(null);
  }

  return (
    <div>
      <label className="cf-field-label" htmlFor="cf-personal-note">
        Add a personal note
        <span className="muted">Optional</span>
      </label>
      <textarea
        id="cf-personal-note"
        className="cf-textarea"
        placeholder="e.g. family commitment, would appreciate the help"
        value={draftNote}
        disabled={disabled}
        onChange={(event) => onDraftChange(event.target.value)}
      />

      <div className="cf-field-label" style={{ marginTop: '0.9rem' }}>
        Help me phrase it
      </div>
      <div className="cf-tones" role="group" aria-label="Rephrase tone">
        {TONES.map((option) => (
          <button
            key={option.value}
            type="button"
            className="cf-chip"
            data-active={tone === option.value}
            disabled={disabled || rephrasing}
            onClick={() => handleTone(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {rephrasing && (
        <div className="cf-status-line" data-busy="true" role="status" aria-live="polite">
          <Loader2 size={14} className="cf-spin" aria-hidden="true" />
          Rephrasing…
        </div>
      )}

      {rephraseError && (
        <p className="cf-rephrase-error" role="alert">
          {rephraseError}
        </p>
      )}

      {proposedText && !rephrasing && (
        <div className="cf-preview" aria-live="polite">
          <div className="cf-field-label">
            <span>
              <Sparkles size={14} aria-hidden="true" style={{ marginRight: '0.3rem' }} />
              Preview
            </span>
          </div>
          <p className="cf-preview-text">&ldquo;{proposedText}&rdquo;</p>
          <div className="cf-preview-actions">
            <button type="button" className="button primary" onClick={useSuggestion} disabled={disabled}>
              Use this
            </button>
            <button type="button" className="button ghost" onClick={keepMine} disabled={disabled}>
              Keep mine
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
