import * as engine from './engine';
import { EngineError } from './engine';

/**
 * Single HTTP-shaped dispatcher for every `/api/*` route CoverAssist calls.
 * Both the MSW browser handlers and the direct fallback in `src/lib/api.ts`
 * route through this function so the two paths can never diverge in
 * behaviour. It intentionally applies no artificial delay so engine/service
 * tests that call it directly stay fast; simulated network latency belongs
 * in the HTTP adapter (`src/lib/api.ts`) and MSW handlers.
 */

export interface MockRequest {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
}

export interface MockResponse {
  status: number;
  body: unknown;
}

function ok(body: unknown): MockResponse {
  return { status: 200, body };
}

function badRequest(message: string): MockResponse {
  return { status: 400, body: { message } };
}

function notFound(): MockResponse {
  return { status: 404, body: { message: 'Not found.' } };
}

function asRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export async function dispatch(request: MockRequest): Promise<MockResponse> {
  const path = request.path.split('?')[0].replace(/\/+$/, '') || '/';
  const key = `${request.method} ${path}`;

  try {
    switch (key) {
      case 'GET /api/me':
        return ok(engine.getMe());

      case 'GET /api/leave/calendar':
        return ok(engine.getCalendar());

      case 'POST /api/leave/evaluate': {
        const body = asRecord(request.body);
        const clinicianId = asString(body.clinicianId);
        const startDate = asString(body.startDate);
        const endDate = asString(body.endDate);
        if (!clinicianId || !startDate || !endDate) {
          return badRequest('clinicianId, startDate and endDate are required.');
        }
        return ok(engine.evaluate({ clinicianId, startDate, endDate }));
      }

      case 'POST /api/leave/find-windows': {
        const body = asRecord(request.body);
        const windows = engine.findWindows({
          clinicianId: asString(body.clinicianId),
          durationDays: asNumber(body.durationDays),
          searchStart: asString(body.searchStart),
          searchEnd: asString(body.searchEnd),
        });
        return ok({ windows });
      }

      case 'POST /api/cover/options': {
        const body = asRecord(request.body);
        const evaluationId = asString(body.evaluationId);
        if (!evaluationId) return badRequest('evaluationId is required.');
        return ok({ options: engine.getCoverOptions(evaluationId) });
      }

      case 'POST /api/ai/rephrase-note': {
        const body = asRecord(request.body);
        const text = asString(body.text) ?? '';
        const tone = asString(body.tone);
        if (tone !== 'friendly' && tone !== 'brief' && tone !== 'professional') {
          return badRequest('tone must be one of friendly, brief or professional.');
        }
        return ok({ text: engine.rephraseNote(text, tone) });
      }

      case 'POST /api/cover/request': {
        const body = asRecord(request.body);
        const optionId = asString(body.optionId);
        if (!optionId) return badRequest('optionId is required.');
        return ok(engine.requestCover({ optionId, personalNote: asString(body.personalNote) }));
      }

      case 'POST /api/cover/respond': {
        const body = asRecord(request.body);
        const response = asString(body.response);
        if (response !== 'accepted' && response !== 'declined') {
          return badRequest('response must be "accepted" or "declined".');
        }
        return ok(engine.respondToCover(response));
      }

      case 'POST /api/cover/revalidate':
        return ok(engine.revalidate());

      case 'POST /api/leave/approve':
        engine.approve();
        return ok(engine.getSnapshot());

      case 'GET /api/demo/state':
        return ok(engine.getSnapshot());

      case 'POST /api/demo/reset':
        return ok(engine.resetDemo());

      case 'POST /api/demo/settings': {
        const body = asRecord(request.body);
        if (typeof body.teamsUnavailable === 'boolean') {
          engine.setTeamsUnavailable(body.teamsUnavailable);
        }
        return ok(engine.getSnapshot());
      }

      default:
        return notFound();
    }
  } catch (error) {
    if (error instanceof EngineError) {
      return badRequest(error.message);
    }
    return { status: 500, body: { message: 'Unexpected demo service error.' } };
  }
}

const DELAY_BY_PREFIX: Array<[string, number]> = [
  ['GET /api/me', 100],
  ['GET /api/leave/calendar', 250],
  ['POST /api/leave/evaluate', 350],
  ['POST /api/leave/find-windows', 450],
  ['POST /api/cover/options', 550],
  ['POST /api/ai/rephrase-note', 650],
  ['POST /api/cover/request', 500],
  ['POST /api/cover/respond', 250],
  ['POST /api/cover/revalidate', 700],
  ['POST /api/leave/approve', 400],
  ['GET /api/demo/state', 100],
  ['POST /api/demo/reset', 200],
  ['POST /api/demo/settings', 150],
];

/** Simulated network latency for a given route, for use by HTTP-shaped adapters only. */
export function delayForRoute(method: string, path: string): number {
  const normalizedPath = path.split('?')[0].replace(/\/+$/, '') || '/';
  const key = `${method} ${normalizedPath}`;
  const found = DELAY_BY_PREFIX.find(([routeKey]) => routeKey === key);
  return found ? found[1] : 300;
}
