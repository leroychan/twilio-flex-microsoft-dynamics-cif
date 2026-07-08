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
});
