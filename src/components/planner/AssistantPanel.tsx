'use client';

import { useState, type FormEvent } from 'react';
import { Bot, CheckCircle2, HelpCircle, Search, Wrench } from 'lucide-react';
import type { CoverOption, LeaveEvaluation } from '@/lib/types';

interface AssistantPanelProps {
  evaluation: LeaveEvaluation | null;
  options: CoverOption[];
  busy: string | null;
  onWhy: () => void;
  onMakeThisWork: () => void;
  onFindWindows: () => void;
}

let logId = 0;

export default function AssistantPanel({ evaluation, options, busy, onWhy, onMakeThisWork, onFindWindows }: AssistantPanelProps) {
  const [log, setLog] = useState<Array<{ id: number; text: string }>>([]);
  const [text, setText] = useState('');
  const isBusy = busy !== null;
  const needsCover = Boolean(evaluation && !evaluation.feasible);

  function addLog(message: string) {
    logId += 1;
    setLog((prev) => [{ id: logId, text: message }, ...prev].slice(0, 4));
  }

  function handleWhy() {
    if (!needsCover) {
      addLog('Select a range that needs cover first, then ask me why.');
      return;
    }
    addLog('Opening the rule evidence for your selected dates.');
    onWhy();
  }

  function handleMakeThisWork() {
    if (!needsCover) {
      addLog('These dates already look feasible — no cover strategies needed.');
      return;
    }
    addLog('Looking for compliant cover strategies for your selected dates.');
    onMakeThisWork();
  }

  function handleFindWindows() {
    addLog('Scanning November for windows with strong staffing.');
    onFindWindows();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    const lower = value.toLowerCase();
    setText('');
    if (lower.includes('why')) {
      handleWhy();
    } else if (lower.includes('work') || lower.includes('cover') || lower.includes('fix') || lower.includes('sarah')) {
      handleMakeThisWork();
    } else if (lower.includes('better') || lower.includes('alternative') || lower.includes('another') || lower.includes('window')) {
      handleFindWindows();
    } else {
      addLog('I can help with: "why these dates", "make this work", or "find better dates".');
    }
  }

  const evidence: string[] = [];
  if (evaluation) {
    evidence.push('Checked selected roster period');
    evidence.push('Evaluated staffing rules');
    if (evaluation.limitingDate) evidence.push(`Identified ${evaluation.limitingDate} as the limiting date`);
    if (options.length > 0) evidence.push(`Found ${options.length} compliant cover strateg${options.length === 1 ? 'y' : 'ies'}`);
  }

  return (
    <section className="ca-panel panel ca-assistant">
      <div className="ca-panel__eyebrow eyebrow">
        <Bot aria-hidden="true" size={14} /> CoverAssist assistant
      </div>
      <p className="muted ca-assistant__intro">
        A transparent simulated assistant — every response below is drawn directly from evaluation results, not
        invented reasoning.
      </p>

      <div className="ca-assistant__chips">
        <button type="button" className="button secondary" onClick={handleWhy} disabled={isBusy}>
          <HelpCircle aria-hidden="true" size={14} /> Why these dates?
        </button>
        <button type="button" className="button secondary" onClick={handleMakeThisWork} disabled={isBusy}>
          <Wrench aria-hidden="true" size={14} /> Make this work
        </button>
        <button type="button" className="button secondary" onClick={handleFindWindows} disabled={isBusy}>
          <Search aria-hidden="true" size={14} /> Find better dates
        </button>
      </div>

      <form className="ca-assistant__form" onSubmit={handleSubmit}>
        <label className="ca-field ca-field--inline">
          <span className="sr-only">Ask CoverAssist</span>
          <input
            type="text"
            placeholder="Ask about these dates…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isBusy}
          />
        </label>
        <button type="submit" className="button ghost" disabled={isBusy || !text.trim()}>
          Ask
        </button>
      </form>

      {evidence.length > 0 ? (
        <ul className="ca-assistant__evidence">
          {evidence.map((line) => (
            <li key={line}>
              <CheckCircle2 aria-hidden="true" size={13} /> {line}
            </li>
          ))}
        </ul>
      ) : null}

      {log.length > 0 ? (
        <ul className="ca-assistant__log">
          {log.map((entry) => (
            <li key={entry.id}>{entry.text}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
