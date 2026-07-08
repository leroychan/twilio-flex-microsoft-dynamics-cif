import { CifClient } from '../cif/CifClient';
import { IntegrationConfig } from '../config/integrationConfig';
import { StoredContact } from '../state/callContext';

/** Strip a channel address prefix (e.g. `whatsapp:+1424` → `+1424`). */
function normalizeIdentifier(raw: unknown): string {
  const s = String(raw ?? '').trim();
  const colon = s.indexOf(':');
  // Only strip a known scheme prefix, never a leading '+' or digits.
  return colon > 0 && /^[a-z]+$/i.test(s.slice(0, colon)) ? s.slice(colon + 1) : s;
}

export async function handleAcceptTask(
  payload: { task: { sid: string; attributes: Record<string, any>; taskChannelUniqueName?: string } },
  deps: { client: Pick<CifClient, 'screenPop'>; cfg: IntegrationConfig; store: (sid: string, c: StoredContact) => void },
): Promise<void> {
  const channel = payload.task.taskChannelUniqueName ?? '';
  const channelCfg = deps.cfg.channels[channel];
  /* eslint-disable no-console */
  console.info('[DynamicsCif] afterAcceptTask', {
    channel,
    handled: !!channelCfg,
    identifierAttr: channelCfg?.identifierAttr,
    attributes: payload.task.attributes,
  });
  if (!channelCfg) {
    console.info('[DynamicsCif] skip: channel not configured');
    return;
  }
  const phone = normalizeIdentifier(payload.task.attributes?.[channelCfg.identifierAttr]);
  if (!phone) {
    console.warn(`[DynamicsCif] skip: no identifier on attribute "${channelCfg.identifierAttr}"`);
    return;
  }
  console.info('[DynamicsCif] screen-pop for:', phone);
  const res = await deps.client.screenPop(phone);
  console.info('[DynamicsCif] screen-pop result:', res);
  if (res.action === 'opened' && res.contactId) {
    deps.store(payload.task.sid, { id: res.contactId, name: res.contactName });
  }
  /* eslint-enable no-console */
}
