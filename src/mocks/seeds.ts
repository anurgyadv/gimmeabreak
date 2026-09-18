import type { Clinician, StaffingRule } from '@/lib/types';

/**
 * Synthetic demo identities and rules for the November 2026 CoverAssist scenario.
 * Not real workforce policy. This module is internal to the mock service layer;
 * UI code must never import it directly.
 */

export const ME_ID = 'clin-001';
export const SARAH_ID = 'clin-002';
export const JAMES_ID = 'clin-003';

export const WARD_ID = 'genmed';
export const WARD_NAME = 'General Medicine';

export const clinicians: Clinician[] = [
  {
    id: ME_ID,
    displayName: 'Dr Anurag Rao',
    initials: 'AR',
    role: 'clinician',
    wardId: WARD_ID,
    wardName: WARD_NAME,
    classification: 'SMO',
    skills: ['general-medicine', 'senior-cover'],
  },
  {
    id: SARAH_ID,
    displayName: 'Dr Sarah Lee',
    initials: 'SL',
    role: 'clinician',
    wardId: WARD_ID,
    wardName: WARD_NAME,
    classification: 'SMO',
    skills: ['general-medicine', 'senior-cover'],
  },
  {
    id: JAMES_ID,
    displayName: 'Dr James Park',
    initials: 'JP',
    role: 'clinician',
    wardId: WARD_ID,
    wardName: WARD_NAME,
    classification: 'SMO',
    skills: ['general-medicine', 'senior-cover'],
  },
  {
    id: 'clin-004',
    displayName: 'Dr Maya Singh',
    initials: 'MS',
    role: 'clinician',
    wardId: WARD_ID,
    wardName: WARD_NAME,
    classification: 'REG',
    skills: ['general-medicine'],
  },
  {
    id: 'clin-005',
    displayName: 'Priya Nair',
    initials: 'PN',
    role: 'roster-manager',
    wardId: WARD_ID,
    wardName: WARD_NAME,
    classification: 'SMO',
    skills: ['roster-management'],
  },
];

export function findClinician(id: string): Clinician | undefined {
  return clinicians.find((c) => c.id === id);
}

export const rules: StaffingRule[] = [
  {
    id: 'genmed-day-min-staff',
    name: 'Minimum day staffing',
    scope: { wardId: WARD_ID, shiftType: 'DAY' },
    type: 'minimum-staff',
    severity: 'hard',
    parameters: { minimum: 5 },
    explanation:
      'At least five eligible clinicians must remain on the General Medicine day roster.',
  },
  {
    id: 'genmed-day-min-smo',
    name: 'Minimum senior coverage',
    scope: { wardId: WARD_ID, shiftType: 'DAY' },
    type: 'minimum-classification',
    severity: 'hard',
    parameters: { classification: 'SMO', minimum: 2 },
    explanation:
      'At least two synthetic SMO-class clinicians must remain on the day roster.',
  },
  {
    id: 'minimum-rest',
    name: 'Minimum rest between shifts',
    scope: {},
    type: 'minimum-rest-hours',
    severity: 'hard',
    parameters: { hours: 10 },
    explanation: 'The demo requires ten hours between rostered shifts.',
  },
  {
    id: 'maximum-weekly-hours',
    name: 'Maximum weekly rostered hours',
    scope: {},
    type: 'maximum-weekly-hours',
    severity: 'hard',
    parameters: { hours: 40 },
    explanation: 'The demo caps rostered hours at forty per week.',
  },
];

export function findRule(id: string): StaffingRule | undefined {
  return rules.find((r) => r.id === id);
}
