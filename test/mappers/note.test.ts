import { buildNote } from '../../src/mappers/note';

describe('buildNote', () => {
  it('binds the note to the contact and builds a subject', () => {
    const p = buildNote({ channel: 'voice', direction: 'inbound', from: '+1424', contactId: 'c1' });
    expect(p['objectid_contact@odata.bind']).toBe('/contacts(c1)');
    expect(p.subject).toBe('Inbound voice — +1424');
  });

  it('omits the contact bind when no contactId', () => {
    const p = buildNote({ channel: 'whatsapp', direction: 'inbound' });
    expect(p['objectid_contact@odata.bind']).toBeUndefined();
  });

  it('includes metadata header, notes and transcript sections in the body', () => {
    const p = buildNote({
      channel: 'voice',
      direction: 'inbound',
      sid: 'CA1',
      from: '+1424',
      agent: 'Jane',
      durationSeconds: 63.7,
      disposition: 'Resolved',
      notes: 'Customer happy',
      transcript: 'Customer: Hi\nAgent: Hello',
    });
    const body = p.notetext as string;
    expect(body).toContain('SID: CA1');
    expect(body).toContain('Agent: Jane');
    expect(body).toContain('Duration (s): 64');
    expect(body).toContain('Disposition: Resolved');
    expect(body).toContain('--- Notes ---\nCustomer happy');
    expect(body).toContain('--- Transcript ---\nCustomer: Hi\nAgent: Hello');
  });

  it('omits notes/transcript sections when absent', () => {
    const body = buildNote({ channel: 'voice', direction: 'outbound' }).notetext as string;
    expect(body).not.toContain('--- Notes ---');
    expect(body).not.toContain('--- Transcript ---');
  });
});
