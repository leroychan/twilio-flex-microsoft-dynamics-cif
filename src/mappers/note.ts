export interface InteractionContext {
  channel: string;
  direction: 'inbound' | 'outbound';
  /** Call SID (voice) or conversation SID (messaging). */
  sid?: string;
  from?: string;
  to?: string;
  queue?: string;
  agent?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  /** Human-readable disposition (label if mapped, else the raw code). */
  disposition?: string;
  notes?: string;
  transcript?: string;
  contactId?: string;
}

function line(label: string, value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return `${label}: ${value}`;
}

/**
 * Build a Dataverse `annotation` (timeline note) payload from an interaction. The body
 * carries a metadata header, the agent's wrap-up notes, and the full transcript. When a
 * contactId is present the note is attached to that contact's timeline.
 */
export function buildNote(ctx: InteractionContext): Record<string, unknown> {
  const dir = ctx.direction === 'inbound' ? 'Inbound' : 'Outbound';
  const channel = ctx.channel || 'interaction';
  const subject = `${dir} ${channel}${ctx.from ? ` — ${ctx.from}` : ''}`.slice(0, 200);

  const header = [
    line('Channel', channel),
    line('Direction', ctx.direction),
    line('SID', ctx.sid),
    line('From', ctx.from),
    line('To', ctx.to),
    line('Queue', ctx.queue),
    line('Agent', ctx.agent),
    line('Started', ctx.startedAt),
    line('Ended', ctx.endedAt),
    ctx.durationSeconds !== undefined ? line('Duration (s)', Math.round(ctx.durationSeconds)) : undefined,
    line('Disposition', ctx.disposition),
  ].filter(Boolean) as string[];

  const sections = [header.join('\n')];
  if (ctx.notes) sections.push(`--- Notes ---\n${ctx.notes}`);
  if (ctx.transcript) sections.push(`--- Transcript ---\n${ctx.transcript}`);

  const payload: Record<string, unknown> = {
    subject,
    notetext: sections.join('\n\n'),
  };
  if (ctx.contactId) payload['objectid_contact@odata.bind'] = `/contacts(${ctx.contactId})`;
  return payload;
}
