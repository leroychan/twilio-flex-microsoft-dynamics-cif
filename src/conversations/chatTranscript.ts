interface MessageLike { author?: string; body?: string; index?: number }
interface PageLike { items: MessageLike[]; hasNextPage: boolean; nextPage(): Promise<PageLike> }
interface ConversationLike { getMessages(): Promise<PageLike> }

export interface ChatDeps {
  getConversation: (sid: string) => Promise<ConversationLike>;
  /** The signed-in agent's conversation identity, used to label Agent vs Customer. */
  agentIdentity: string | undefined;
}

/** Resolve a conversation SID from a Flex messaging task's attributes. */
export function resolveConversationSid(attributes: Record<string, any> | undefined): string | undefined {
  const a = attributes ?? {};
  return a.conversationSid || a.channelSid || a.conversations?.conversation_sid || undefined;
}

/**
 * Read a messaging conversation's full history, formatted as speaker-labelled lines.
 * Returns '' when there is no conversation or on any failure (best-effort).
 */
export async function readChatTranscript(
  conversationSid: string | undefined,
  deps: ChatDeps,
): Promise<string> {
  if (!conversationSid) return '';
  try {
    const convo = await deps.getConversation(conversationSid);
    const collected: MessageLike[] = [];
    let page = await convo.getMessages();
    while (page) {
      page.items.forEach((msg) => collected.push(msg));
      if (page.hasNextPage) page = await page.nextPage();
      else break;
    }
    return collected
      .slice()
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .filter((msg) => (msg.body ?? '').trim())
      .map((msg) => {
        const isAgent = !!msg.author && !!deps.agentIdentity && msg.author === deps.agentIdentity;
        return `${isAgent ? 'Agent' : 'Customer'}: ${(msg.body ?? '').trim()}`;
      })
      .join('\n');
  } catch {
    return '';
  }
}
