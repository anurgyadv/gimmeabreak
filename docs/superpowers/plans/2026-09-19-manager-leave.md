# Manager leave planning and guided leave requests

User-approved scope: manager-only fairness evidence (balances, recorded leave by type, previous year), excess-leave review and in-app employee invitations with algorithmic suggestions; employee-row monthly calendar matching supplied image; actionable request explanations and button-led chat; cosmetic cancellation watch only when another person's booked leave is relevant. No automatic scheduler, external email/Teams, automatic approval, or invented policy violation.

Architecture: Full SQLite evidence queries produce typed department data and ranked leave windows. Manager endpoints enforce signed manager session. In-app invitations are persisted using Azure Table Storage and exposed only to addressed employee or department manager. The calendar is a dedicated component; chat and booking UI share explicit actions. All state-changing actions are click-confirmed and audited.

Implementation sequence:
- [x] Data queries: current department membership, historical leave by type/year with source statuses and bounded period semantics, monthly spans, balances and conservative date suggestions. Focused tests.
- [x] Manager UI: employee-row calendar, filters, detail drawer with history/balance tabs, plan candidates and invitation composer.
- [x] Integration: role-guarded API, persistent in-app messages, employee inbox, contextual chat buttons, cosmetic watch cards, clear blockers and remedies.
- [x] Verification: focused tests, complete existing suite, production build, read-only artifact scan, browser exercise, deployed checks.

Important limits: leave records do not prove attendance; duplicate/overlapping span hours must not be blindly prorated or counted as taken; no recorded history differs from zero leave. Source excess flags are review triggers only. Suggestions use roster impact and known absences, manager verifies clinical ratios. Personal leave must never become a negative fairness score. Employee session remains SYN008078; other synthetic employees can receive persistent invitations but their sign-in is not connected.

File ownership: data agent owns workforce-db.ts, department-insights.ts, department-types.ts and focused tests. Manager UI agent owns src/components/manager/* only. Root owns API, persistence, chat integration, existing WorkforceApp, config and final checks.

