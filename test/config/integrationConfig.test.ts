import { getConfig } from '../../src/config/integrationConfig';

describe('getConfig', () => {
  it('returns sane defaults', () => {
    const c = getConfig();
    expect(c.contactSearchFields).toContain('telephone1');
    expect(c.attr.callerNumber).toBeTruthy();
    expect(c.channels.voice.transcriptSource).toBe('sync-rtt');
    expect(c.channels.whatsapp.transcriptSource).toBe('conversation');
  });
  it('applies overrides shallowly per key', () => {
    const c = getConfig({ contactSearchFields: ['mobilephone'] });
    expect(c.contactSearchFields).toEqual(['mobilephone']);
    expect(c.channels.voice.identifierAttr).toBe('caller');
  });
  it('deep-merges partial attr override and keeps other attr fields at defaults', () => {
    const c = getConfig({ attr: { callerNumber: 'x' } } as any);
    expect(c.attr.callerNumber).toBe('x');
    expect(c.attr.disposition).toBe('disposition');
    expect(c.attr.notes).toBe('wrapUpNotes');
    expect(c.attr.direction).toBe('direction');
  });
  it('deep-merges partial dispositionMap override', () => {
    const c = getConfig({ dispositionMap: { resolved: 'Resolved' } });
    expect(c.dispositionMap).toEqual({ resolved: 'Resolved' });
  });
  it('replaces the channels map when overridden', () => {
    const c = getConfig({ channels: { voice: { identifierAttr: 'from', transcriptSource: 'none' } } });
    expect(Object.keys(c.channels)).toEqual(['voice']);
    expect(c.channels.voice.transcriptSource).toBe('none');
  });
  it('returns fresh channels object (no shared reference across calls)', () => {
    const a = getConfig();
    a.channels.voice.identifierAttr = 'mutated';
    const b = getConfig();
    expect(b.channels.voice.identifierAttr).toBe('caller');
  });
});
