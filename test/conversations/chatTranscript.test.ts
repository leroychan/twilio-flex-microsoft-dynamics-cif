import { readChatTranscript, resolveConversationSid, ChatDeps } from '../../src/conversations/chatTranscript';

function depsFor(messages: any[], agentIdentity = 'agent1'): ChatDeps {
  const page = { items: messages, hasNextPage: false, nextPage: async () => page };
  return {
    agentIdentity,
    getConversation: async () => ({ getMessages: async () => page }),
  };
}

describe('resolveConversationSid', () => {
  it('prefers conversationSid, then channelSid, then nested', () => {
    expect(resolveConversationSid({ conversationSid: 'CH1' })).toBe('CH1');
    expect(resolveConversationSid({ channelSid: 'CH2' })).toBe('CH2');
    expect(resolveConversationSid({ conversations: { conversation_sid: 'CH3' } })).toBe('CH3');
    expect(resolveConversationSid({})).toBeUndefined();
  });
});

describe('readChatTranscript', () => {
  it('returns "" when there is no conversation sid', async () => {
    expect(await readChatTranscript(undefined, depsFor([]))).toBe('');
  });

  it('labels agent vs customer by author identity and orders by index', async () => {
    const out = await readChatTranscript('CH1', depsFor([
      { author: 'agent1', body: 'Hello', index: 2 },
      { author: 'whatsapp:+1424', body: 'Hi', index: 1 },
    ]));
    expect(out).toBe('Customer: Hi\nAgent: Hello');
  });

  it('skips empty bodies and never throws on error', async () => {
    const bad: ChatDeps = { agentIdentity: 'a', getConversation: async () => { throw new Error('boom'); } };
    expect(await readChatTranscript('CH1', bad)).toBe('');
    expect(await readChatTranscript('CH1', depsFor([{ author: 'x', body: '  ', index: 1 }]))).toBe('');
  });
});
