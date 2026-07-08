import { buildContactQuery, parseContactResults } from '../../src/mappers/contactSearch';

describe('buildContactQuery', () => {
  it('selects contactid + fullname and ORs each field on the phone', () => {
    const q = buildContactQuery('+15551234567', ['telephone1', 'mobilephone']);
    expect(q.startsWith('?$select=')).toBe(true);
    expect(q).toContain('contactid');
    expect(q).toContain('fullname');
    expect(q).toContain("telephone1 eq '%2B15551234567'"); // '+' URL-encoded so it isn't decoded to a space
    expect(q).toContain(' or ');
    expect(q).toContain("mobilephone eq '%2B15551234567'");
  });
  it("escapes single quotes and URL-encodes the phone value", () => {
    const q = buildContactQuery("O'+1", ['telephone1']);
    expect(q).toContain("telephone1 eq 'O''%2B1'");
  });
});

describe('parseContactResults', () => {
  it('maps contactid to id', () => {
    const raw = JSON.stringify([{ contactid: 'abc', fullname: 'Jane' }]);
    expect(parseContactResults(raw)).toEqual([{ id: 'abc', fullname: 'Jane' }]);
  });
  it('parses the CIF numeric-keyed object shape { "0": {...}, "1": {...} }', () => {
    const raw = JSON.stringify({
      0: { contactid: 'c1', fullname: 'Jane' },
      1: { contactid: 'c2', fullname: 'John' },
    });
    expect(parseContactResults(raw)).toEqual([
      { id: 'c1', fullname: 'Jane' },
      { id: 'c2', fullname: 'John' },
    ]);
  });
  it('returns [] for empty payloads or objects with no record rows', () => {
    expect(parseContactResults('[]')).toEqual([]);
    expect(parseContactResults('{}')).toEqual([]);
    expect(parseContactResults('')).toEqual([]);
  });
});
