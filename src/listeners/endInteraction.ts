import { CifClient } from '../cif/CifClient';
import { IntegrationConfig } from '../config/integrationConfig';
import { StoredContact } from '../state/callContext';
import { buildNote, InteractionContext } from '../mappers/note';
import { resolveConversationSid } from '../conversations/chatTranscript';

export interface EndInteractionTask {
  sid: string;
  attributes: Record<string, any>;
  taskChannelUniqueName?: string;
  queueName?: string;
  age?: number;
  dateCreated?: Date | string;
  dateUpdated?: Date | string;
}

export interface EndInteractionDeps {
  client: Pick<CifClient, 'createNote'>;
  cfg: IntegrationConfig;
  getContact: (sid: string) => StoredContact | undefined;
  clear: (sid: string) => void;
  /** Injected transcript fetchers (built with Flex runtime in the plugin). */
  fetchVoiceTranscript: (callSid: string | undefined) => Promise<string>;
  fetchChatTranscript: (attributes: Record<string, any>) => Promise<string>;
  agentName?: string;
}

function iso(d: Date | string | undefined): string | undefined {
  if (!d) return undefined;
  try { return typeof d === 'string' ? d : d.toISOString(); } catch { return undefined; }
}

export async function handleCompleteTask(
  payload: { task: EndInteractionTask },
  deps: EndInteractionDeps,
): Promise<void> {
  const { task } = payload;
  const channel = task.taskChannelUniqueName ?? '';
  const channelCfg = deps.cfg.channels[channel];
  if (!channelCfg) return; // channel not handled — do not log or clear

  try {
    const a = task.attributes ?? {};
    const direction = a[deps.cfg.attr.direction] === 'outbound' ? 'outbound' : 'inbound';

    let transcript = '';
    let sid: string | undefined;
    if (channelCfg.transcriptSource === 'sync-rtt') {
      sid = a.call_sid;
      transcript = await deps.fetchVoiceTranscript(sid);
    } else if (channelCfg.transcriptSource === 'conversation') {
      sid = resolveConversationSid(a);
      transcript = await deps.fetchChatTranscript(a);
    } else {
      sid = a.call_sid ?? resolveConversationSid(a);
    }

    const rawDisposition = a[deps.cfg.attr.disposition];
    const disposition = rawDisposition
      ? (deps.cfg.dispositionMap[rawDisposition] ?? String(rawDisposition))
      : undefined;

    const stored = deps.getContact(task.sid);
    const ctx: InteractionContext = {
      channel,
      direction,
      sid,
      from: a[channelCfg.identifierAttr] ?? a.from,
      to: a.to,
      queue: task.queueName,
      agent: deps.agentName,
      startedAt: iso(task.dateCreated),
      endedAt: iso(task.dateUpdated),
      durationSeconds: typeof task.age === 'number' ? task.age : undefined,
      disposition,
      notes: a[deps.cfg.attr.notes],
      transcript,
      contactId: stored?.id,
    };
    // eslint-disable-next-line no-console
    console.info('[DynamicsCif] end-interaction note', {
      channel, sid, contactId: stored?.id, transcriptLength: transcript.length,
    });
    await deps.client.createNote(buildNote(ctx));
  } finally {
    deps.clear(task.sid);
  }
}
