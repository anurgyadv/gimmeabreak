import { describe, expect, it } from 'vitest';
import { runTool, toolDefinitions, simulateCoverage, shiftHours } from '../src/lib/gimme-engine';

describe('GimmeABreak evidence tools', () => {
  it('computes net shift hours including overnight shifts', () => {
    expect(shiftHours('07:00', '15:30', 30)).toBe(8);
    expect(shiftHours('22:00', '06:30', 30)).toBe(8);
    expect(() => shiftHours('invalid', '06:30', 30)).toThrow();
    expect(() => shiftHours('07:00', '08:00', 61)).toThrow();
    expect(() => shiftHours('07:00', '08:00', -1)).toThrow();
    expect(() => shiftHours('25:00', '08:00', 0)).toThrow();
  });
  it('does not use a future balance or claim verified policy compliance', () => {
    expect(runTool('balance').status).toBe('warning');
    expect(runTool('policy').status).toBe('warning');
    expect(runTool('recommendation').status).toBe('warning');
  });
  it('retains provenance for every tool', () => {
    for (const tool of toolDefinitions) {
      expect(runTool(tool.id).sources.length).toBeGreaterThan(0);
      expect(runTool(tool.id).facts.length).toBeGreaterThan(0);
    }
  });
  it('recalculates coverage capacity without treating it as approval', () => {
    const result = simulateCoverage('SYN000894');
    expect(result.projectedHours).toBe(79.5);
    expect(result.remainingHours).toBe(0.5);
    expect(result.withinContract).toBe(true);
    expect(result.status).toBe('Requires review');
    expect(result.unresolved.length).toBeGreaterThan(0);
    expect(() => simulateCoverage('nonexistent')).toThrow();
  });
  it('keeps the same unresolved policy checks for each alternative', () => {
    const first = simulateCoverage('SYN000894');
    const second = simulateCoverage('SYN001237');
    expect(second.projectedHours).toBe(79.5);
    expect(second.unresolved).toEqual(first.unresolved);
    expect(second.unresolved).toHaveLength(4);
  });
  it('keeps medical specialty and the separate HSS process visible', () => {
    expect(runTool('constraints').facts.join(' ')).toContain('medical specialties are not interchangeable');
    expect(runTool('recommendation').facts.join(' ')).toContain('Safety is the first criterion, equity second');
    expect(runTool('recommendation').facts.join(' ')).toContain('HSS submission, supervisor approval and payroll updates remain separate');
  });
});
