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
  // CIF searchAndOpenRecords resolves to either a JSON array or (more commonly) an
  // object keyed by numeric strings: { "0": {...}, "1": {...} }. Normalize both to rows.
  let rows: any[];
  if (Array.isArray(parsed)) {
    rows = parsed;
  } else if (parsed && typeof parsed === 'object') {
    rows = Object.keys(parsed)
      .filter((k) => /^\d+$/.test(k))
      .map((k) => (parsed as any)[k]);
  } else {
    return [];
  }
  return rows
    .filter((r) => r && typeof r === 'object' && r.contactid)
    .map((r: any) => ({ id: r.contactid, fullname: r.fullname }));
}
