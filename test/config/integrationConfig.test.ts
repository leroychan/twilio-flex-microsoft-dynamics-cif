import { getConfig } from '../../src/config/integrationConfig';

describe('getConfig', () => {
  it('returns sane defaults', () => {
    const c = getConfig();
    expect(c.contactSearchFields).toContain('telephone1');
    expect(c.dispositionFieldName).toBe('new_disposition');
    expect(c.attr.callerNumber).toBeTruthy();
  });
  it('applies overrides shallowly per key', () => {
    const c = getConfig({ contactSearchFields: ['mobilephone'] });
    expect(c.contactSearchFields).toEqual(['mobilephone']);
    expect(c.dispositionFieldName).toBe('new_disposition');
  });
  it('deep-merges partial attr override and keeps other attr fields at defaults', () => {
    const c = getConfig({ attr: { callerNumber: 'x' } } as any);
    expect(c.attr.callerNumber).toBe('x');
    expect(c.attr.disposition).toBe('disposition');
    expect(c.attr.notes).toBe('wrapUpNotes');
    expect(c.attr.direction).toBe('direction');
  });
  it('deep-merges partial dispositionMap override and keeps dispositionFieldName unchanged', () => {
    const c = getConfig({ dispositionMap: { resolved: 1 } });
    expect(c.dispositionMap).toEqual({ resolved: 1 });
    expect(c.dispositionFieldName).toBe('new_disposition');
  });
});
