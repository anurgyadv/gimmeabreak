import { http, HttpResponse, delay, type JsonBodyType } from 'msw';
import { delayForRoute, dispatch } from './scenarios';

/**
 * MSW request handlers for every `/api/*` route. All routing/state logic
 * lives in `dispatch`; this file only adapts MSW's request/response shapes
 * and applies the simulated network latency for each route.
 */
async function handle(method: 'GET' | 'POST', request: Request): Promise<Response> {
  const url = new URL(request.url);
  let body: unknown;
  if (method === 'POST') {
    try {
      body = await request.json();
    } catch {
      body = undefined;
    }
  }

  await delay(delayForRoute(method, url.pathname));
  const result = await dispatch({ method, path: url.pathname, body });
  return HttpResponse.json(result.body as JsonBodyType, { status: result.status });
}

export const handlers = [
  http.get('/api/*', ({ request }) => handle('GET', request)),
  http.post('/api/*', ({ request }) => handle('POST', request)),
];
