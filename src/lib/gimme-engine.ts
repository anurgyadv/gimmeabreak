import demo from '@/data/coverassist-demo.json';

export { demo };
export type ToolId = 'employee' | 'balance' | 'roster' | 'policy' | 'constraints' | 'candidates' | 'simulation' | 'recommendation';
export type ToolResult = { id: ToolId; status: 'complete' | 'warning'; summary: string; facts: string[]; sources: string[]; kind: 'Data fact' | 'Calculation' | 'Evidence review'; duration: number };
export type AuditEvent = { id: string; time: string; actor: string; action: string; detail: string; sources: string[] };
export const toolDefinitions: { id: ToolId; label: string; tool: string; description: string }[] = [
  { id: 'employee', label: 'Checking employee details', tool: 'get_leave_case', description: 'Resolve the employee, classification and active contract.' },
  { id: 'balance', label: 'Checking leave balance', tool: 'get_leave_balance', description: 'Find a balance valid at the decision date; exclude future snapshots.' },
  { id: 'roster', label: 'Checking roster and overlapping leave', tool: 'get_roster_impact', description: 'Join the leave request to affected roster assignments.' },
  { id: 'policy', label: 'Checking applicable policies', tool: 'get_applicable_rules', description: 'Inspect policy availability, scope and missing rule evidence.' },
  { id: 'constraints', label: 'Checking workforce constraints', tool: 'check_workforce_constraints', description: 'Separate measured facts from unresolved safety checks.' },
  { id: 'candidates', label: 'Finding coverage options', tool: 'find_coverage_candidates', description: 'Check role, rate, availability and contract matches.' },
  { id: 'simulation', label: 'Calculating coverage scenarios', tool: 'simulate_coverage_plan', description: 'Recalculate net shift hours and projected contract capacity.' },
  { id: 'recommendation', label: 'Preparing manager recommendation', tool: 'save_draft_recommendation', description: 'Assemble an evidence summary with explicit outstanding checks.' },
];

export function shiftHours(start: string, end: string, meal: number) {
  const minutes = (value: string) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Invalid shift time');
    const [h, m] = value.split(':').map(Number); return h * 60 + m;
  };
  const from = minutes(start); let to = minutes(end);
  if (to <= from) to += 1440;
  if (!Number.isFinite(meal) || meal < 0 || meal > to - from) throw new Error('Invalid meal break');
  return Math.round((to - from - meal) / 60 * 100) / 100;
}

export function simulateCoverage(employeeId: string) {
  const candidate = demo.scenario.candidates.find(c => c.employeeId === employeeId);
  if (!candidate) throw new Error('Candidate not present in the prepared evidence');
  const hours = demo.scenario.affectedShifts.reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime, s.mealBreakMinutes), 0);
  const projectedHours = candidate.currentPayPeriodHours + hours;
  return { employeeId, hours, projectedHours, remainingHours: candidate.contractHours - projectedHours,
    withinContract: projectedHours <= candidate.contractHours && !candidate.rosterConflict && !candidate.leaveConflict,
    status: 'Requires review' as const, unresolved: demo.scenario.policyChecks.filter(c => c.result !== 'pass').map(c => c.name) };
}

export function runTool(id: ToolId): ToolResult {
  const started = performance.now();
  const { scenario: s, provenance: p } = demo;
  const source = (kind: string) => p.sourceFiles.find(f => f.kind === kind)!.fileName;
  const shift = s.affectedShifts[0];
  const common = { id, duration: 0 };
  const results: Record<ToolId, Omit<ToolResult, 'id' | 'duration'>> = {
    employee: { status: 'complete', kind: 'Data fact', summary: `${s.employee.employeeId} · ${s.employee.role}`, facts: [`Contract active ${s.employee.sourceFields['Position Entry Start Date']} to ${s.employee.sourceFields['Position Entry End Date']}.`, `${s.employee.rateId} · ${s.employee.contractHours} contract hours · home unit ${s.employee.homeUnit}.`, `Join key: Employee ID. Analysis as of ${p.decisionDate}.`], sources: [source('contracts'), 'Employee ID → Position Name → Position Rate ID → Total Position Entry Contract Hours'] },
    balance: { status: 'warning', kind: 'Evidence review', summary: 'No valid balance at the decision date', facts: [s.balance.explanation, `Future snapshot: ${s.balance.futureSnapshot.remainingHours.toFixed(2)} hours effective ${s.balance.futureSnapshot.effectiveDate}; excluded from entitlement assessment.`, `${s.request.requestedHours} hours requested. Sufficiency cannot be determined.`], sources: [source('balances'), 'Date Effective ≤ decision date; Employee ID + annual leave type'] },
    roster: { status: 'complete', kind: 'Calculation', summary: `${s.affectedShifts.length} rostered shift affected · ${shift.netHours} hours to cover`, facts: [`${shift.shiftDate} · ${shift.rosterUnit} · ${shift.startTime}–${shift.endTime}.`, `(${shift.endTime} − ${shift.startTime}) − ${shift.mealBreakMinutes} minute meal break = ${shiftHours(shift.startTime, shift.endTime, shift.mealBreakMinutes)} hours.`, 'The source booked-leave request overlaps this assigned shift. Unit-wide minimum staffing is not supplied.'], sources: [source('rosters'), source('leave'), 'Employee ID + Shift Date within Leave Start Date / Leave End Date'] },
    policy: { status: 'warning', kind: 'Evidence review', summary: 'Policy references found; rule text is not indexed', facts: ['Discovery links do not establish the applicable industrial instrument or its effective version.', 'Applicable staffing and fatigue rules are not indexed in this workspace. Credentials and medical specialty compatibility require verification.', 'No policy-dependent compliance claim can be made. Manager verification is required.'], sources: ['GimmeABreak_Local_AI_Agent_Full_Documentation.docx · sections 11 and Appendix C', 'Prepared artifact: scenario.policyChecks'] },
    constraints: { status: 'warning', kind: 'Evidence review', summary: `${s.policyChecks.length} checks need further evidence`, facts: s.policyChecks.map(c => c.id === 'credentials' ? 'Credentials, specialty and skill mix: medical specialties are not interchangeable. Confirm the candidate’s specialty and service requirements.' : c.id === 'fatigue' ? 'Fatigue and rest: the applicable rule is not indexed in this workspace.' : `${c.name}: ${c.explanation}`), sources: ['Prepared artifact: scenario.policyChecks', source('balances'), source('rosters')] },
    candidates: { status: 'complete', kind: 'Data fact', summary: `${s.candidates.length} coverage options shown from ${s.eligibleCandidatePoolSize} prepared matches`, facts: s.candidates.map(c => `${c.employeeId}: ${c.rateId}; no detected roster/leave conflict; ${c.priorUnitShiftCount} scheduled unit shifts before the requested shift. These include forward roster assignments, not verified completed experience.`), sources: [source('contracts'), source('leave'), source('rosters'), 'Prepared matching filters; only the two selected options are bundled, not the entire candidate pool.'] },
    simulation: { status: 'warning', kind: 'Calculation', summary: 'Both options fit recorded contract capacity; safety checks remain open', facts: s.candidates.map(c => { const sim = simulateCoverage(c.employeeId); return `${c.employeeId}: ${c.currentPayPeriodHours} + ${sim.hours} = ${sim.projectedHours} / ${c.contractHours} hours; ${sim.remainingHours} hours remaining. Not a verified overtime or fatigue assessment.`; }), sources: [source('rosters'), source('contracts'), 'Pay period: 2026-09-21 to 2026-10-04; net shift duration excludes meal breaks.'] },
    recommendation: { status: 'warning', kind: 'Evidence review', summary: 'Cannot assess final eligibility · coverage options available', facts: ['Safety is the first criterion, equity second. The original assignment needs 8 hours of replacement cover.', 'Two prepared candidates fit the recorded role, rate and contract capacity checks.', 'Confirm entitlement, applicable policy, staffing, rest and credentials before any final approval.', 'This is a deterministic demo summary. HSS submission, supervisor approval and payroll updates remain separate from this workspace.'], sources: ['Results of employee, balance, roster, policy, constraints, candidates and simulation tools', p.dataVersion] },
  };
  return { ...common, ...results[id], duration: Math.max(1, Math.round(performance.now() - started)) };
}
