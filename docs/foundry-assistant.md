# Foundry assistant

The interface at `src/components/chat` calls server routes under `/api/chat`. The backend uses a real Foundry chat-completions tool loop. No language-model answer is generated when credentials are missing.

## Infrastructure

Use an existing Azure trial or student subscription with remaining credit. This deployment uses the existing Free Trial subscription with its spending limit enabled. Do not remove its spending limit or upgrade to pay-as-you-go. Check model/region quota before provisioning. `infra/foundry.bicep` describes a Foundry account/project, one small standard model deployment and private Storage account. Deployment parameters must be chosen from the subscription's available models and regions; the defaults are examples, not a guarantee of student availability.

The model endpoint is the Azure resource endpoint, not a portal page or project URL. The backend uses `/openai/v1/chat/completions` with a tool-capable deployment. Supported endpoint domains: `*.services.ai.azure.com` and `*.openai.azure.com`.

Set server environment variables from `.env.example` in Vercel and local `.env.local`. Never place a key in `NEXT_PUBLIC_*`, source code, chat messages or browser storage.

- FOUNDRY_ENDPOINT / FOUNDRY_MODEL / FOUNDRY_API_KEY
- AZURE_STORAGE_CONNECTION_STRING
- CHAT_SESSION_SECRET: random32+ characters
- CHAT_ACCESS_CODE / MANAGER_ACCESS_CODE: distinct random12+ characters
- CHAT_DAILY_LIMIT: maximum100 model conversations/day, plus20/hour/employee. Maximum5 model rounds,1000 output tokens/round. These controls bound usage but are not a billing guarantee.

## Data and authorization

All four source CSVs are normalized into `data/workforce.sqlite.gz`. The143.6MB database expands into a hash-verified server temporary cache and is opened read-only with Node22 SQLite. The19MB compressed artifact and manifest are explicitly traced into server functions. Neither the DB nor credentials are in public assets. See `docs/full-data.md` for row counts and exclusions.

Balance/roster/profile tools query this complete database. Matching uses the connected nursing candidate pool from the validated workforce extract and explicitly identifies that scope; it is not an exhaustive whole-archive search. Indexed policy sections come from official sources. Historical staffing is never represented as a mandatory minimum.

An access-code session assumes synthetic employee SYN008078 (Sarah Chen); this is not Entra workforce authentication. Cookie signatures bind employee/role, are HttpOnly and expire after8h. A separate manager code authorizes central decisions. Production employee identity requires actual Entra ID→employee mapping; changing a prompt or client employee ID cannot change the current server identity.

## Actions and persistence

The model can prepare a signed10-minute confirmation proposal. It cannot submit or approve. Clicking Confirm calls a separate endpoint that checks identity/signature, reassesses balance/conflicts, serializes submissions with an employee lock and saves a central request. Repeated confirmation of the same proposal is idempotent. Managers separately confirm staffing/clinical checks, and written reasons are required for refusal/changes.

Azure Table Storage keeps requests, planning invitations, audit events, counters and locks across Vercel instances. Local development can use an ignored file; production refuses that fallback. Newly submitted calendar and assistant requests share the central request store. Unsubmitted drafts and legacy browser-only records remain local.

Manager-only tools provide monthly department leave, employee history and ranked leave-plan options. The department API enforces the manager role and target membership; employee invitations are restricted to the signed employee. Invitations support in-app replies but do not send external messages or approve leave. Cancellation-watch cards are local cosmetic previews with no active scheduler.

No Teams/email connector is configured. The assistant must not claim it sent a message or obtained colleague consent. Do not mistake the existing colleague response preview for external messaging.

## Verification

`npm test -- --reporter=dot`, `npm run build`, then test `/api/chat/status`. Unlock with the private employee access code and ask “What are my leave balances?”. A live integration check must show an actual Foundry response and `get_my_balances` tool event, including129.091 annual hours as of17 September2026. Unit tests use a mocked provider only to verify orchestration; they do not prove Azure connectivity.

Access-code prompts are temporarily disabled at user request. The app automatically opens an employee or manager signed session when switching views. Anyone visiting the public app can select either synthetic role. Session signing, role checks, same-origin mutation checks and model usage limits remain enforced.
