import { dispatch, delayForRoute } from '@/mocks/scenarios';
import type {
  Clinician,
  CoverOption,
  CoverRequest,
  DemoSnapshot,
  LeaveDayFeasibility,
  LeaveEvaluation,
  LeaveWindow,
  NoteTone,
  RevalidationResult,
} from './types';

/**
 * Typed HTTP client for CoverAssist's `/api/*` contract. Uses ordinary
 * `fetch` so MSW can intercept it transparently in the browser. If no MSW
 * handler is present to answer (no route/service worker registered, e.g.
 * `mockServiceWorker.js` has not been generated yet, or `worker.start()`
 * failed), the same call falls back to the in-process scenario dispatcher so
 * the rest of the app keeps working through the identical typed responses.
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractMessage(res: Response): Promise<string> {
  try {
    const payload = await res.clone().json();
    if (payload && typeof payload === 'object' && typeof (payload as { message?: unknown }).message === 'string') {
      return (payload as { message: string }).message;
    }
  } catch {
    // Body was not JSON; fall through to the status text.
  }
  return res.statusText || `Request failed with status ${res.status}`;
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let response: Response | null = null;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    response = null; // Network-level failure: no worker/backend answered at all.
  }

  const contentType = response?.headers.get('content-type') ?? '';
  if (response && contentType.includes('application/json')) {
    if (!response.ok) {
      throw new ApiError(await extractMessage(response), response.status);
    }
    return (await response.json()) as T;
  }

  // No JSON handler intercepted the request (MSW not started/registered, or
  // the route simply doesn't exist as a real backend yet). Use the same
  // typed dispatcher directly, preserving identical contracts and behavior.
  await wait(delayForRoute(method, path));
  const result = await dispatch({ method, path: `/api${path}`, body });
  if (result.status >= 400) {
    const message =
      result.body && typeof result.body === 'object' && typeof (result.body as { message?: unknown }).message === 'string'
        ? (result.body as { message: string }).message
        : 'Request failed.';
    throw new ApiError(message, result.status);
  }
  return result.body as T;
}

export const api = {
  getMe: () => call<Clinician>('GET', '/me'),
  getCalendar: () => call<LeaveDayFeasibility[]>('GET', '/leave/calendar'),

  evaluateLeave: (input: { clinicianId: string; startDate: string; endDate: string }) =>
    call<LeaveEvaluation>('POST', '/leave/evaluate', input),

  findWindows: (input?: { clinicianId?: string; durationDays?: number; searchStart?: string; searchEnd?: string }) =>
    call<{ windows: LeaveWindow[] }>('POST', '/leave/find-windows', input ?? {}),

  getCoverOptions: (evaluationId: string) =>
    call<{ options: CoverOption[] }>('POST', '/cover/options', { evaluationId }),

  rephraseNote: (text: string, tone: NoteTone) =>
    call<{ text: string }>('POST', '/ai/rephrase-note', { text, tone }),

  requestCover: (optionId: string, personalNote?: string) =>
    call<CoverRequest>('POST', '/cover/request', { optionId, personalNote }),

  respondCover: (response: 'accepted' | 'declined') =>
    call<CoverRequest>('POST', '/cover/respond', { response }),

  revalidate: () => call<RevalidationResult>('POST', '/cover/revalidate'),

  approve: () => call<DemoSnapshot>('POST', '/leave/approve'),

  getState: () => call<DemoSnapshot>('GET', '/demo/state'),

  resetDemo: () => call<DemoSnapshot>('POST', '/demo/reset'),

  setSettings: (settings: { teamsUnavailable: boolean }) =>
    call<DemoSnapshot>('POST', '/demo/settings', settings),
};
