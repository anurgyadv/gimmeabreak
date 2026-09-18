# CoverAssist

A frontend prototype for exploring clinician leave, understanding coverage constraints, coordinating cover, and making a human approval decision.

## Run locally

Requires Node.js 20.9 or newer.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. The application uses local assets and synthetic scenarios; it needs no API keys, AI subscription, or Teams tenant to run.

```sh
npm run build
npm start
```

Produces a static site in `out/` and serves it at http://127.0.0.1:3001. The bundled server supports clean URLs. Browser service workers require localhost or HTTPS. Do not open the HTML files directly with a `file:` URL.

## Demo story

1. Open the leave planner in November 2026. Select 18–20 November by dragging, clicking the start and end dates, or using the date fields.
2. See feasibility fall to 31. Open the explanation: 18 November has only one remaining senior clinician against a synthetic minimum of two.
3. Choose **Make this work**. Sarah is the best fit; James introduces a downstream rest conflict. Moving leave to 23–25 November is the no-cover alternative.
4. Ask Sarah. Enter an optional personal note and try a phrasing suggestion. Explicitly choose **Use this** before the suggestion replaces your text.
5. Send the simulated request and open the cover inbox. Accept as Sarah, then revalidate the roster to reach feasibility 94.
6. Open the manager view and approve the revalidated request.

Use **Reset demo** to restore the initial state. `/demo` contains the walkthrough and an internal Cover Inbox fallback toggle. State persists in this browser between refreshes.

## Architecture

- Next.js App Router, React and TypeScript, with static export.
- Tailwind, application-owned styling, Radix dialogs, Lucide icons, and Motion.
- UI → typed React context → API client → ordinary HTTP requests intercepted by MSW → deterministic scenario service.
- Service state owns evaluations, consent, revalidation and approval. A new evaluation invalidates the old resolution.
- The same dispatcher supports an in-memory fallback if MSW cannot initialize.
- `/planner?host=teams&subEntityId=leave-eval-1820` demonstrates an embedded host layout and a request deep link. Optional `theme=dark` or `theme=contrast` demonstrates host theming.

The workforce data, people, rules, AI phrasing and Teams messages are simulated. Feasibility is **not** an approval probability. There is no live Teams, Azure, Entra, AI service, or production scheduling solver integration.

The product brief is in [docs/project-brief.md](docs/project-brief.md); implementation ownership and dependencies are in [docs/implementation-plan.md](docs/implementation-plan.md).

## Development approach

Codex owns architecture, contracts, integration and final inspection. Three bounded Claude Code lanes implement the scenario service, planner, and coordination screens in isolated worktrees using the user's Claude subscription. No provider API keys or paid API credits are used.

`npm run build` passed, including TypeScript and static export, on 18 September 2026. Automated test work was skipped at the user's request. Full visual and interaction review remains pending; see [docs/HANDOFF.md](docs/HANDOFF.md) for the resumable checkpoint.
