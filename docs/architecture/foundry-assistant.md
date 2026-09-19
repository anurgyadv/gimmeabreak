# Foundry workforce assistant implementation

Use the accepted design from the conversation: Vercel interface → server-authenticated synthetic employee session → Foundry model with allowlisted functions → deterministic data/policy checks → explanation and explicit-confirmation request actions. No model-generated approval or undisclosed fake responses.

All four supplied synthetic CSV files are imported into indexed SQLite, compressed as a server-only deployment artifact with source provenance. Existing connected workforce slice remains the checked swap-engine input; full archive queries provide personal balances, roster and absence facts, with scope disclosed where matching is bounded. Policy index is retrieved by relevant clauses; source text is untrusted evidence.

Azure for Students: provision only within the user's existing student subscription/credit and supported model quota; do not upgrade to paid subscription or reserve paid throughput. Use an available low-cost tool-capable Foundry deployment. Backend credentials remain server environment variables. Limit model rounds, response size, per-session requests, and require a private preview access code before credit-consuming calls. Session identity is server-bound, never from user/model employee IDs.

Implementation lanes: full SQLite ingestion and query module; independent chat panel; root model/tool orchestration, server API, session/auth, durable records/audit and integration/deployment.

Server workflow: expose balance/roster/policy/assessment/swap tools. Request submissions require a server-issued short-lived signed proposal and an explicit confirmation endpoint. Store confirmed requests and audit centrally using Azure Table Storage when configured; use local file storage for local development only, fail closed on Vercel when durable storage is missing. No external colleague messages without an implemented service and explicit user confirmation.

Verification: parameter validation, employee scoping, prompt/tool injection rejection, signed-session/proposal tampering, tool loop limits, no provider error secrets, real data query counts, balance/roster validation, persisted submission idempotency; build and live Foundry tool call. If Azure quota/access blocks deployment, finish all independent implementation and report exact missing access without claiming a live model.
