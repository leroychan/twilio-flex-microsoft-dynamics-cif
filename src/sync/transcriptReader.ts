export interface TranscriptItem {
  track?: string;
  speaker: 'Customer' | 'Agent' | string;
  transcript: string;
  confidence?: number | null;
  timestamp?: string;
  sequenceId: number;
}

// MUST match the RTT Function's writer (functions-rtt/sync.private.ts): Twilio Sync
// rejects a uniqueName matching the SID pattern (54302), so the list is named with
// this prefix on both the writer and this reader.
export const LIST_NAME_PREFIX = 'rtt-';
export function listNameFor(callSid: string): string {
  return `${LIST_NAME_PREFIX}${callSid}`;
}

// Minimal shape of the twilio-sync list API we use — keeps tests from needing the SDK.
interface SyncListLike {
  getItems(opts: { from: number; order: 'asc' | 'desc'; pageSize: number }): Promise<SyncPage>;
  close(): void;
}
interface SyncPage {
  items: Array<{ data: TranscriptItem }>;
  hasNextPage: boolean;
  nextPage(): Promise<SyncPage>;
}
export interface SyncClientLike {
  list(name: string): Promise<SyncListLike>;
}

function formatItems(items: TranscriptItem[]): string {
  const ordered = [...items].sort((a, b) => a.sequenceId - b.sequenceId);
  const lines: string[] = [];
  for (const it of ordered) {
    const text = (it.transcript ?? '').trim();
    if (!text) continue;
    // Merge consecutive utterances from the same speaker onto one line.
    const last = lines.length ? lines[lines.length - 1] : undefined;
    if (last && last.startsWith(`${it.speaker}: `)) {
      lines[lines.length - 1] = `${last} ${text}`;
    } else {
      lines.push(`${it.speaker}: ${text}`);
    }
  }
  return lines.join('\n');
}

/**
 * Read the full RTT transcript for a call from Twilio Sync. Returns '' when there is
 * no callSid or nothing was transcribed, and never throws (transcript is best-effort).
 * `getClient` supplies a Sync client (built in the plugin runtime; injected in tests).
 */
export async function readTranscript(
  callSid: string | undefined,
  getClient: () => SyncClientLike,
): Promise<string> {
  if (!callSid) return '';
  try {
    const client = getClient();
    const list = await client.list(listNameFor(callSid));
    const collected: TranscriptItem[] = [];
    let page = await list.getItems({ from: 0, order: 'asc', pageSize: 50 });
    while (page) {
      page.items.forEach((i) => collected.push(i.data));
      if (page.hasNextPage) page = await page.nextPage();
      else break;
    }
    list.close();
    return formatItems(collected);
  } catch {
    return '';
  }
}
