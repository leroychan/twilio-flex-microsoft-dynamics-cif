import { CifClient } from '../cif/CifClient';
import { IntegrationConfig } from '../config/integrationConfig';

export async function handleAcceptTask(
  payload: { task: { sid: string; attributes: Record<string, any> } },
  deps: { client: Pick<CifClient, 'screenPop'>; cfg: IntegrationConfig; store: (sid: string, id: string) => void },
): Promise<void> {
  const phone = payload.task.attributes?.[deps.cfg.attr.callerNumber];
  if (!phone) return;
  const res = await deps.client.screenPop(String(phone));
  if (res.action === 'opened' && res.contactId) deps.store(payload.task.sid, res.contactId);
}
