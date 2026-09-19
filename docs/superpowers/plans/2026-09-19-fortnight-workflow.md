# Next-fortnight data integration

The user requests direct implementation of a concise employee-first workflow using the entire supplied ZIP and verified policy sources. This replaces the single-case UI and its extraneous conversation/evidence features.

## Boundaries

- Read every source CSV from the supplied archive. Derive a complete nursing-department fortnight, connected candidates, all leave-type balances and overlapping leave. Keep date/source provenance.
- Main page: personal balance cards, upcoming shifts and request status. No employee picker.
- Booking page: actual next-fortnight roster, selectable dates, leave type, note, Start booking. Popup shows observable checks, not hidden model reasoning.
- Suggest bilateral swaps only after checking requester and candidate schedules, leave, role, hours and rest. State policy applicability and missing patient census explicitly; preserving roster headcount alone is not proof of ratios.
- Outreach remains a local preview with an explicit colleague response simulation until a messaging provider is connected. Do not assert a person accepted or that a message was delivered externally.
- Separate employee and clinical manager modes. Manager sees department roster, request queue, before/after effects and policy references; final action is a local recorded decision.
- Ignore HSS integration in the product flow, remove conversation drafts and Ask the evidence. Retain concise policy citations within outcomes.

## Work lanes

1. Data lane: ZIP ingestion and typed workforce JSON.
2. Policy lane: official policy downloads/index, cited rules with applicability restrictions.
3. Main lane: tested assessment/swap functions, UI state machine, persistence, integration and final browser checks.

## Verification

Meaningful tests cover date-effective balances, conflicting and overnight shifts, both sides of swaps, rest and hours constraints, and manager prerequisites. Production build, typecheck and browser tests cover balance → booking → checks → suggestions → response → manager queue, plus simple requests and rejection paths.
