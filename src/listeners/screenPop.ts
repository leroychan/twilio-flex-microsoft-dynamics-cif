import { CifClient } from '../cif/CifClient';
import { IntegrationConfig } from '../config/integrationConfig';

export async function handleAcceptTask(
  payload: { task: { sid: string; attributes: Record<string, any>; taskChannelUniqueName?: string } },
  deps: { client: Pick<CifClient, 'screenPop'>; cfg: IntegrationConfig; store: (sid: string, id: string) => void },
): Promise<void> {
  /* eslint-disable no-console */
  console.info('[DynamicsCif] afterAcceptTask', {
    channel: payload.task.taskChannelUniqueName,
    expectedVoiceChannel: deps.cfg.voiceChannelName,
    callerAttr: deps.cfg.attr.callerNumber,
    attributes: payload.task.attributes,
  });
  if (payload.task.taskChannelUniqueName !== deps.cfg.voiceChannelName) {
    console.info('[DynamicsCif] skip: not the voice channel');
    return;
  }
  const phone = payload.task.attributes?.[deps.cfg.attr.callerNumber];
  if (!phone) {
    console.warn(`[DynamicsCif] skip: no phone on attribute "${deps.cfg.attr.callerNumber}"`);
    return;
  }
  console.info('[DynamicsCif] screen-pop for phone:', String(phone));
  const res = await deps.client.screenPop(String(phone));
  console.info('[DynamicsCif] screen-pop result:', res);
  if (res.action === 'opened' && res.contactId) deps.store(payload.task.sid, res.contactId);
  /* eslint-enable no-console */
}
