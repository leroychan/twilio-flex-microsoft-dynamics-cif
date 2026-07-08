export interface ContactMatch { id: string; fullname?: string }

function esc(v: string): string {
  return v.replace(/'/g, "''");
}

export function buildContactQuery(phone: string, fields: string[]): string {
  const filter = fields.map((f) => `${f} eq '${esc(phone)}'`).join(' or ');
  return `?$select=contactid,fullname&$filter=${filter}`;
}

export function parseContactResults(rawJson: string): ContactMatch[] {
  if (!rawJson) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(rawJson); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((r: any) => ({ id: r.contactid, fullname: r.fullname }));
}
