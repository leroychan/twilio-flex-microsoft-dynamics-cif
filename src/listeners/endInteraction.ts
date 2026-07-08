import { CifClient } from '../cif/CifClient';
import { IntegrationConfig, resolveChannelKey } from '../config/integrationConfig';
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

/** Transcript reads are best-effort; never let a stalled Sync/Conversations call hang. */
const TRANSCRIPT_TIMEOUT_MS = 8000;
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const t = setTimeout(() => { if (!settled) { settled = true; resolve(fallback); } }, ms);
    const finish = (v: T) => { if (!settled) { settled = true; clearTimeout(t); resolve(v); } };
    p.then(finish, () => finish(fallback));
  });
}

export async function handleCompleteTask(
  payload: { task: EndInteractionTask },
  deps: EndInteractionDeps,
): Promise<void> {
  const { task } = payload;
  const channel = resolveChannelKey(deps.cfg, task.taskChannelUniqueName, task.attributes);
  const channelCfg = channel ? deps.cfg.channels[channel] : undefined;
  if (!channel || !channelCfg) return; // channel not handled — do not log or clear

  try {
    const a = task.attributes ?? {};
    const direction = a[deps.cfg.attr.direction] === 'outbound' ? 'outbound' : 'inbound';

    let transcript = '';
    let sid: string | undefined;
    if (channelCfg.transcriptSource === 'sync-rtt') {
      sid = a.call_sid;
      transcript = await withTimeout(deps.fetchVoiceTranscript(sid), TRANSCRIPT_TIMEOUT_MS, '');
    } else if (channelCfg.transcriptSource === 'conversation') {
      sid = resolveConversationSid(a);
      transcript = await withTimeout(deps.fetchChatTranscript(a), TRANSCRIPT_TIMEOUT_MS, '');
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
