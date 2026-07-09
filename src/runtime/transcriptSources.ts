import { Manager } from '@twilio/flex-ui';
import { SyncClient } from 'twilio-sync';

import { readTranscript, SyncClientLike } from '../sync/transcriptReader';
import { readChatTranscript, resolveConversationSid, ChatDeps } from '../conversations/chatTranscript';

// This module is the ONLY place that touches @twilio/flex-ui + twilio-sync for
// transcript retrieval. It is imported by the plugin at runtime, never by tests
// (the flex-ui prod bundle cannot load under jsdom), keeping the reader modules pure.

// Flex's Manager.insightsClient is ACL-scoped and returns 54007 for our list, so we
// build our own SyncClient on the account DEFAULT service (where the RTT Function
// writes via Runtime.getSync()), reusing Flex's user token — no API key needed.
let cachedSync: SyncClientLike | undefined;
function getSyncClient(): SyncClientLike {
  if (!cachedSync) {
    const client = new SyncClient(Manager.getInstance().user.token) as unknown as SyncClientLike & {
      on(ev: string, fn: () => void): void;
      updateToken(t: string): void;
    };
    client.on('tokenAboutToExpire', () => client.updateToken(Manager.getInstance().user.token));
    client.on('tokenExpired', () => client.updateToken(Manager.getInstance().user.token));
    cachedSync = client;
  }
  return cachedSync;
}

function chatDeps(): ChatDeps {
  const m = Manager.getInstance();
  const cc: any = (m as any).conversationsClient;
  return {
    getConversation: (sid: string) => cc.getConversationBySid(sid),
    agentIdentity: cc?.user?.identity ?? (m as any).user?.identity,
  };
}

/** Fetch the RTT speech-to-text transcript for a voice call. */
export function fetchVoiceTranscript(callSid: string | undefined): Promise<string> {
  return readTranscript(callSid, getSyncClient);
}

/** Fetch the message history for a messaging (e.g. WhatsApp) task. */
export function fetchChatTranscript(attributes: Record<string, any> | undefined): Promise<string> {
  return readChatTranscript(resolveConversationSid(attributes), chatDeps());
}
