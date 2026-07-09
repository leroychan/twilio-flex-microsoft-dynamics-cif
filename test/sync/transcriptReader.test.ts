import { readTranscript, listNameFor, SyncClientLike } from '../../src/sync/transcriptReader';

function fakeClient(itemsPages: any[][]): { client: SyncClientLike; opened: string[] } {
  const opened: string[] = [];
  const makePage = (idx: number): any => ({
    items: itemsPages[idx].map((data) => ({ data })),
    hasNextPage: idx < itemsPages.length - 1,
    nextPage: async () => makePage(idx + 1),
  });
  const client: SyncClientLike = {
    list: async (name: string) => {
      opened.push(name);
      return { getItems: async () => makePage(0), close: () => undefined };
    },
  };
  return { client, opened };
}

describe('readTranscript', () => {
  it('returns "" when callSid is missing', async () => {
    expect(await readTranscript(undefined, () => { throw new Error('should not be called'); } )).toBe('');
  });

  it('opens the prefixed list and formats ordered speaker lines', async () => {
    const { client, opened } = fakeClient([[
      { speaker: 'Customer', transcript: 'Hi there', sequenceId: 1 },
      { speaker: 'Agent', transcript: 'Hello, how can I help?', sequenceId: 2 },
    ]]);
    const out = await readTranscript('CA123', () => client);
    expect(opened).toEqual([listNameFor('CA123')]);
    expect(out).toBe('Customer: Hi there\nAgent: Hello, how can I help?');
  });

  it('sorts by sequenceId and merges consecutive same-speaker utterances', async () => {
    const { client } = fakeClient([[
      { speaker: 'Agent', transcript: 'and again', sequenceId: 3 },
      { speaker: 'Customer', transcript: 'first', sequenceId: 1 },
      { speaker: 'Agent', transcript: 'thanks', sequenceId: 2 },
    ]]);
    const out = await readTranscript('CA1', () => client);
    expect(out).toBe('Customer: first\nAgent: thanks and again');
  });

  it('drains multiple pages', async () => {
    const { client } = fakeClient([
      [{ speaker: 'Customer', transcript: 'p1', sequenceId: 1 }],
      [{ speaker: 'Agent', transcript: 'p2', sequenceId: 2 }],
    ]);
    expect(await readTranscript('CA1', () => client)).toBe('Customer: p1\nAgent: p2');
  });

  it('returns "" and never throws when the client errors', async () => {
    const client: SyncClientLike = { list: async () => { throw new Error('54007'); } };
    expect(await readTranscript('CA1', () => client)).toBe('');
  });
});
