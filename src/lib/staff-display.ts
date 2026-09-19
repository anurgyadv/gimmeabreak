// Presentation aliases keep workforce identifiers out of the everyday interface.
// The original identifiers and alias mapping remain available in Data sources.
export const staffAliases: Record<string, string> = {
  SYN001597: 'Sarah Chen',
  SYN000894: 'Emily Zhang',
  SYN001237: 'James Wilson',
};
export function staffName(id: string) { return staffAliases[id] ?? id; }
export function displayEvidence(text: string) {
  return text.replace(/SYN\d+/g, staffName)
    .replace(/deterministic demo/gi, 'workforce analysis')
    .replace(/prepared matches/g, 'matching records')
    .replace(/prepared candidates/g, 'coverage candidates')
    .replace(/prepared matching filters/gi, 'Role, rate and availability filters')
    .replace(/prepared artifact/gi, 'Analysis record')
    .replace(/prepared evidence/gi, 'available records')
    .replace(/demo summary/g, 'summary');
}
