import { buildContactQuery, parseContactResults } from '../../src/mappers/contactSearch';

describe('buildContactQuery', () => {
  it('selects contactid + fullname and ORs each field on the phone', () => {
    const q = buildContactQuery('+15551234567', ['telephone1', 'mobilephone']);
    expect(q.startsWith('?$select=')).toBe(true);
    expect(q).toContain('contactid');
    expect(q).toContain('fullname');
    expect(q).toContain("telephone1 eq '+15551234567'");
    expect(q).toContain(' or ');
    expect(q).toContain("mobilephone eq '+15551234567'");
  });
  it("escapes single quotes in the phone value", () => {
    const q = buildContactQuery("O'+1", ['telephone1']);
    expect(q).toContain("telephone1 eq 'O''+1'");
  });
});

describe('parseContactResults', () => {
  it('maps contactid to id', () => {
    const raw = JSON.stringify([{ contactid: 'abc', fullname: 'Jane' }]);
    expect(parseContactResults(raw)).toEqual([{ id: 'abc', fullname: 'Jane' }]);
  });
  it('returns [] for empty or non-array payloads', () => {
    expect(parseContactResults('[]')).toEqual([]);
    expect(parseContactResults('{}')).toEqual([]);
    expect(parseContactResults('')).toEqual([]);
  });
});
