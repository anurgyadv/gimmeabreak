import type {
  AuditEvent,
  CoverOption,
  CoverRequest,
  CoverageMetric,
  DemoSnapshot,
  FeasibilityStatus,
  LeaveEvaluation,
  LeaveWindow,
  NoteTone,
  RevalidationResult,
  RuleViolation,
} from '@/lib/types';
import {
  ALTERNATE_WINDOW_DATES,
  HERO_LIMITING_DATE,
  NOVEMBER_END,
  NOVEMBER_START,
  addDays,
  buildCalendar,
  enumerateDates,
  formatDateLabel,
  isWellFormedDate,
  isWithinNovember2026,
  scoreRange,
} from './calendar';
import { JAMES_ID, ME_ID, SARAH_ID, clinicians, findClinician } from './seeds';
import { clearPersisted, loadPersisted, savePersisted } from './storage';

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}

const STORAGE_KEY = 'coverassist:demo-state';
const STORAGE_VERSION = 1;

const SARAH_OPTION_ID = 'cover-sarah';
const ALTERNATE_OPTION_ID = 'cover-alt-dates';
const JAMES_OPTION_ID = 'cover-james';

interface EngineState {
  evaluation: LeaveEvaluation | null;
  coverRequest: CoverRequest | null;
  revalidation: RevalidationResult | null;
  approved: boolean;
  audit: AuditEvent[];
  teamsUnavailable: boolean;
  evalSeq: number;
  requestSeq: number;
  auditSeq: number;
  revalidatedForRequestId: string | null;
}

function createInitialState(): EngineState {
  return {
    evaluation: null,
    coverRequest: null,
    revalidation: null,
    approved: false,
    audit: [],
    teamsUnavailable: false,
    evalSeq: 0,
    requestSeq: 0,
    auditSeq: 0,
    revalidatedForRequestId: null,
  };
}

let state: EngineState = loadPersisted<EngineState>(STORAGE_KEY, STORAGE_VERSION) ?? createInitialState();

function persist(): void {
  savePersisted(STORAGE_KEY, STORAGE_VERSION, state);
}

function pushAudit(label: string): void {
  state.auditSeq += 1;
  const event: AuditEvent = {
    id: `audit-${state.auditSeq}`,
    label,
    at: new Date().toISOString(),
  };
  state.audit = [...state.audit, event];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateClinicianId(clinicianId: string): void {
  if (!findClinician(clinicianId)) {
    throw new EngineError(`Unknown clinician "${clinicianId}".`);
  }
}

function validateRange(startDate: string, endDate: string): void {
  if (!isWellFormedDate(startDate) || !isWellFormedDate(endDate)) {
    throw new EngineError('Dates must be well-formed calendar dates in YYYY-MM-DD format.');
  }
  if (!isWithinNovember2026(startDate) || !isWithinNovember2026(endDate)) {
    throw new EngineError('This demo only supports dates within November 2026.');
  }
  if (startDate > endDate) {
    throw new EngineError('The end date must be on or after the start date.');
  }
}

// ---------------------------------------------------------------------------
// Metrics / violations
// ---------------------------------------------------------------------------

function buildMetrics(status: FeasibilityStatus): CoverageMetric[] {
  const seniorAfter = status === 'difficult' ? 1 : 2;
  const totalAfter = status === 'difficult' || status === 'cover-needed' ? 5 : 6;
  return [
    {
      id: 'total-staff',
      label: 'Total staffing',
      before: 6,
      after: totalAfter,
      required: 5,
      unit: 'staff',
      satisfied: totalAfter >= 5,
    },
    {
      id: 'senior-cover',
      label: 'Senior coverage',
      before: 2,
      after: seniorAfter,
      required: 2,
      unit: 'staff',
      satisfied: seniorAfter >= 2,
    },
    {
      id: 'skill-mix',
      label: 'Skill mix',
      before: 100,
      after: 100,
      required: 100,
      unit: 'percent',
      satisfied: true,
    },
  ];
}

function buildViolations(status: FeasibilityStatus, limitingDate: string): RuleViolation[] {
  if (status !== 'difficult') return [];
  return [
    {
      ruleId: 'genmed-day-min-smo',
      ruleName: 'Minimum senior coverage',
      date: limitingDate,
      severity: 'hard',
      required: 2,
      available: 1,
      unit: 'clinicians',
      explanation: 'Your leave would reduce senior coverage from two clinicians to one.',
    },
  ];
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function getMe() {
  const me = findClinician(ME_ID);
  if (!me) throw new EngineError('Demo persona is not configured.');
  return me;
}

export function getCalendar() {
  return buildCalendar();
}

export function findWindows(input: {
  clinicianId?: string;
  durationDays?: number;
  searchStart?: string;
  searchEnd?: string;
}): LeaveWindow[] {
  const clinicianId = input.clinicianId ?? ME_ID;
  validateClinicianId(clinicianId);

  const durationDays = input.durationDays && input.durationDays > 0 ? Math.floor(input.durationDays) : 3;
  const searchStart = input.searchStart ?? NOVEMBER_START;
  const searchEnd = input.searchEnd ?? NOVEMBER_END;
  validateRange(searchStart, searchEnd);

  const results: LeaveWindow[] = [];
  for (const start of enumerateDates(searchStart, searchEnd)) {
    const end = addDays(start, durationDays - 1);
    if (end > searchEnd || !isWithinNovember2026(end)) continue;

    const { score, status, limitingDate } = scoreRange(start, end);
    const feasible = status === 'easy' || status === 'good';
    results.push({
      startDate: start,
      endDate: end,
      score,
      status,
      coverRequired: !feasible,
      explanation: feasible
        ? 'Strong staffing and no additional cover required.'
        : `${formatDateLabel(limitingDate)} would need cover support.`,
    });
  }

  results.sort((a, b) => b.score - a.score || a.startDate.localeCompare(b.startDate));
  return results.slice(0, 3);
}

function buildEvaluation(clinicianId: string, startDate: string, endDate: string): LeaveEvaluation {
  const { score, status, limitingDate } = scoreRange(startDate, endDate);
  const feasible = status === 'easy' || status === 'good';
  const metrics = buildMetrics(status);
  const violations = buildViolations(status, limitingDate);

  state.evalSeq += 1;
  return {
    evaluationId: `eval-${state.evalSeq}`,
    clinicianId,
    startDate,
    endDate,
    feasible,
    score,
    status,
    limitingDate: feasible ? undefined : limitingDate,
    metrics,
    violations,
    summary: feasible
      ? 'No additional cover required for this period.'
      : `${formatDateLabel(limitingDate)} is the limiting date.`,
  };
}

export function evaluate(input: { clinicianId: string; startDate: string; endDate: string }): LeaveEvaluation {
  validateClinicianId(input.clinicianId);
  validateRange(input.startDate, input.endDate);

  const evaluation = buildEvaluation(input.clinicianId, input.startDate, input.endDate);

  // A new selection invalidates any prior cover workflow tied to the old evaluation.
  state.evaluation = evaluation;
  state.coverRequest = null;
  state.revalidation = null;
  state.approved = false;
  state.revalidatedForRequestId = null;
  pushAudit(`Evaluated ${formatDateLabel(input.startDate)}–${formatDateLabel(input.endDate)}: score ${evaluation.score}.`);
  persist();
  return evaluation;
}

function buildCoverOptions(evaluation: LeaveEvaluation): CoverOption[] {
  if (evaluation.feasible) return [];

  const limitingDate = evaluation.limitingDate ?? evaluation.startDate;
  const downstreamDate = addDays(limitingDate, 3);
  const alternates = findWindows({ clinicianId: evaluation.clinicianId });
  const bestAlternate = alternates[0] ?? {
    startDate: ALTERNATE_WINDOW_DATES[0],
    endDate: ALTERNATE_WINDOW_DATES[ALTERNATE_WINDOW_DATES.length - 1],
    score: 94,
  };

  const sarah = findClinician(SARAH_ID);
  const james = findClinician(JAMES_ID);

  const options: CoverOption[] = [
    {
      id: SARAH_OPTION_ID,
      strategy: 'swap',
      clinicianId: SARAH_ID,
      clinicianName: sarah?.displayName,
      classification: sarah?.classification,
      score: 93,
      rank: 1,
      recommended: true,
      overtimeHours: 0,
      rosterChanges: 1,
      restCompliant: true,
      qualificationCompliant: true,
      explanation: 'Rest compliant, no overtime and no downstream coverage issue.',
    },
    {
      id: ALTERNATE_OPTION_ID,
      strategy: 'alternate-dates',
      score: bestAlternate.score,
      rank: 2,
      recommended: false,
      overtimeHours: 0,
      rosterChanges: 0,
      restCompliant: true,
      qualificationCompliant: true,
      explanation: `Move leave to ${formatDateLabel(bestAlternate.startDate)}–${formatDateLabel(bestAlternate.endDate)}; no cover required.`,
    },
    {
      id: JAMES_OPTION_ID,
      strategy: 'replacement',
      clinicianId: JAMES_ID,
      clinicianName: james?.displayName,
      classification: james?.classification,
      score: 67,
      rank: 3,
      recommended: false,
      overtimeHours: 0,
      rosterChanges: 2,
      restCompliant: false,
      qualificationCompliant: true,
      downstreamConflict: {
        date: downstreamDate,
        ruleId: 'minimum-rest',
        explanation: `Solves ${formatDateLabel(limitingDate)} but creates a synthetic minimum-rest conflict before the ${formatDateLabel(downstreamDate)} assignment.`,
      },
      explanation: 'Solves the selected gap but creates a downstream rest conflict.',
    },
  ];

  return options;
}

export function getCoverOptions(evaluationId: string): CoverOption[] {
  if (!state.evaluation || state.evaluation.evaluationId !== evaluationId) {
    throw new EngineError('This evaluation is no longer current. Re-evaluate the selected range.');
  }
  return buildCoverOptions(state.evaluation);
}

export function rephraseNote(text: string, tone: NoteTone): string {
  const trimmed = text.trim();
  const body = trimmed.length > 0 ? trimmed : 'a personal commitment on this date';
  const lowerFirst = body.charAt(0).toLowerCase() + body.slice(1);
  const capitalized = body.charAt(0).toUpperCase() + body.slice(1);

  switch (tone) {
    case 'friendly':
      return `Hi! ${capitalized}. I'd really appreciate the help if you're available — no pressure if you can't.`;
    case 'brief':
      return `${capitalized}. I'd appreciate the cover if you're available.`;
    case 'professional':
      return `I have ${lowerFirst}. I would be grateful if you are available to cover the proposed shift.`;
    default:
      return capitalized;
  }
}

export function requestCover(input: { optionId: string; personalNote?: string }): CoverRequest {
  if (!state.evaluation) {
    throw new EngineError('Select and evaluate a leave range before requesting cover.');
  }
  if (state.evaluation.feasible) {
    throw new EngineError('This leave range does not require cover.');
  }
  if (state.coverRequest && state.coverRequest.status !== 'declined') {
    throw new EngineError('A cover request is already pending a response.');
  }

  const options = buildCoverOptions(state.evaluation);
  const option = options.find((o) => o.id === input.optionId);
  if (!option) {
    throw new EngineError(`Unknown cover option "${input.optionId}".`);
  }
  if (option.id !== SARAH_OPTION_ID) {
    throw new EngineError('Only Dr Sarah Lee can be requested for cover in this demo.');
  }

  const sarah = findClinician(SARAH_ID);
  if (!sarah) throw new EngineError('Recipient is not available.');

  state.requestSeq += 1;
  const request: CoverRequest = {
    id: `cr-${state.requestSeq}`,
    leaveEvaluationId: state.evaluation.evaluationId,
    requesterId: state.evaluation.clinicianId,
    recipientId: sarah.id,
    recipientName: sarah.displayName,
    optionId: option.id,
    personalNote: input.personalNote?.trim() || undefined,
    status: 'sent',
    sentAt: new Date().toISOString(),
  };

  state.coverRequest = request;
  state.revalidation = null;
  state.approved = false;
  state.revalidatedForRequestId = null;
  pushAudit(`Cover request sent to ${sarah.displayName}.`);
  persist();
  return request;
}

export function respondToCover(response: 'accepted' | 'declined'): CoverRequest {
  if (!state.coverRequest || state.coverRequest.status !== 'sent') {
    throw new EngineError('There is no pending cover request to respond to.');
  }

  const request: CoverRequest = {
    ...state.coverRequest,
    status: response,
    respondedAt: new Date().toISOString(),
  };
  state.coverRequest = request;
  pushAudit(
    response === 'accepted'
      ? `${request.recipientName} accepted the cover request.`
      : `${request.recipientName} declined the cover request.`,
  );
  persist();
  return request;
}

export function revalidate(): RevalidationResult {
  if (!state.evaluation || !state.coverRequest) {
    throw new EngineError('Send a cover request before revalidating.');
  }
  if (state.coverRequest.leaveEvaluationId !== state.evaluation.evaluationId) {
    throw new EngineError('The cover request no longer matches the current evaluation.');
  }
  if (state.coverRequest.status === 'declined') {
    throw new EngineError('A declined cover request cannot be revalidated.');
  }
  if (state.coverRequest.status !== 'accepted' && state.coverRequest.status !== 'revalidated') {
    throw new EngineError('Wait for a response before revalidating.');
  }

  const beforeScore = state.evaluation.score;
  const afterScore = state.evaluation.limitingDate === HERO_LIMITING_DATE
    ? 94
    : Math.min(96, beforeScore + 55);

  const result: RevalidationResult = {
    coverRequestId: state.coverRequest.id,
    valid: true,
    beforeScore,
    afterScore,
    checks: [
      { ruleId: 'genmed-day-min-staff', label: 'Minimum staffing', passed: true },
      { ruleId: 'genmed-day-min-smo', label: 'Senior coverage', passed: true },
      { ruleId: 'classification', label: 'Classification mix', passed: true },
      { ruleId: 'minimum-rest', label: 'Rest requirement', passed: true },
      { ruleId: 'maximum-weekly-hours', label: 'Maximum hours', passed: true },
      { ruleId: 'staff-consent', label: 'Staff consent', passed: true },
    ],
  };

  state.revalidation = result;
  state.coverRequest = { ...state.coverRequest, status: 'revalidated' };

  if (state.revalidatedForRequestId !== result.coverRequestId) {
    state.revalidatedForRequestId = result.coverRequestId;
    pushAudit(`Roster revalidated: ${result.beforeScore} → ${result.afterScore}.`);
  }

  persist();
  return result;
}

export function approve(): void {
  if (state.approved) return; // idempotent

  if (!state.evaluation) {
    throw new EngineError('There is no evaluation to approve.');
  }

  if (state.evaluation.feasible) {
    state.approved = true;
    pushAudit('Manager approved the leave request (no cover required).');
    persist();
    return;
  }

  const validRevalidation =
    state.coverRequest &&
    state.revalidation &&
    state.coverRequest.leaveEvaluationId === state.evaluation.evaluationId &&
    state.revalidation.coverRequestId === state.coverRequest.id &&
    state.revalidation.valid &&
    state.coverRequest.status === 'revalidated';

  if (!validRevalidation) {
    throw new EngineError('Approval requires a valid current revalidation for this evaluation.');
  }

  state.approved = true;
  pushAudit('Manager approved the leave request.');
  persist();
}

export function setTeamsUnavailable(value: boolean): void {
  state.teamsUnavailable = value;
  pushAudit(value ? 'Teams marked unavailable; using cover inbox fallback.' : 'Teams marked available.');
  persist();
}

export function getSnapshot(): DemoSnapshot {
  return {
    evaluation: state.evaluation,
    coverRequest: state.coverRequest,
    revalidation: state.revalidation,
    approved: state.approved,
    audit: state.audit,
    teamsUnavailable: state.teamsUnavailable,
  };
}

export function resetDemo(): DemoSnapshot {
  state = createInitialState();
  clearPersisted(STORAGE_KEY);
  persist();
  return getSnapshot();
}

export function listClinicians() {
  return clinicians;
}
