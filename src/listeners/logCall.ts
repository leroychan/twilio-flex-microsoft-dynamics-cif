import { CifClient } from '../cif/CifClient';
import { IntegrationConfig } from '../config/integrationConfig';
import { CallContext } from '../mappers/phonecall';

export async function handleCompleteTask(
  payload: { task: { sid: string; attributes: Record<string, any>; taskChannelUniqueName?: string } },
  deps: {
    client: Pick<CifClient, 'logCall'>;
    cfg: IntegrationConfig;
    getContact: (sid: string) => string | undefined;
    clear: (sid: string) => void;
  },
): Promise<void> {
  if (payload.task.taskChannelUniqueName !== deps.cfg.voiceChannelName) return;
  const a = payload.task.attributes ?? {};
  const direction = a[deps.cfg.attr.direction] === 'outbound' ? 'outbound' : 'inbound';
  const ctx: CallContext = {
    direction,
    phoneNumber: a[deps.cfg.attr.callerNumber],
    dispositionCode: a[deps.cfg.attr.disposition],
    notes: a[deps.cfg.attr.notes],
    contactId: deps.getContact(payload.task.sid),
  };
  try {
    await deps.client.logCall(ctx);
  } finally {
    deps.clear(payload.task.sid);
  }
}
