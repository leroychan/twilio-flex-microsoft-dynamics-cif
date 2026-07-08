export interface ContactMatch { id: string; fullname?: string }

function encodeValue(v: string): string {
  // OData string-literal escaping (double single-quotes), then URL-encode so characters
  // like '+' survive transport. An un-encoded '+' is decoded to a space by the Web API,
  // which would make every E.164 number (all start with '+') fail to match.
  return encodeURIComponent(v.replace(/'/g, "''"));
}

export function buildContactQuery(phone: string, fields: string[]): string {
  const value = encodeValue(phone);
  const filter = fields.map((f) => `${f} eq '${value}'`).join(' or ');
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
