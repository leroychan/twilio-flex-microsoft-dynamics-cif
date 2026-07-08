export interface CallContext {
  direction: 'inbound' | 'outbound';
  phoneNumber?: string;
  durationMinutes?: number;
  notes?: string;
  dispositionCode?: string;
  contactId?: string;
  subject?: string;
}

export function buildPhonecall(
  ctx: CallContext,
  cfg: { dispositionFieldName: string; dispositionMap: Record<string, number> },
): Record<string, unknown> {
  const inbound = ctx.direction === 'inbound';
  const p: Record<string, unknown> = {
    subject: ctx.subject ?? `${inbound ? 'Inbound' : 'Outbound'} call${ctx.phoneNumber ? ` — ${ctx.phoneNumber}` : ''}`,
    directioncode: inbound ? 0 : 1,
    statecode: 1,
    statuscode: inbound ? 4 : 2,
  };
  if (ctx.phoneNumber) p.phonenumber = ctx.phoneNumber;
  if (ctx.notes) p.description = ctx.notes;
  if (typeof ctx.durationMinutes === 'number') p.actualdurationminutes = Math.round(ctx.durationMinutes);
  if (ctx.contactId) p['regardingobjectid_contact@odata.bind'] = `/contacts(${ctx.contactId})`;
  if (ctx.dispositionCode &&
      Object.prototype.hasOwnProperty.call(cfg.dispositionMap, ctx.dispositionCode)) {
    p[cfg.dispositionFieldName] = cfg.dispositionMap[ctx.dispositionCode];
  }
  return p;
}
