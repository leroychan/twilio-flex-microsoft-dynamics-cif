import { buildPhonecall } from '../../src/mappers/phonecall';

const cfg = { dispositionFieldName: 'new_disposition', dispositionMap: { resolved: 100000001 } };

describe('buildPhonecall', () => {
  it('sets inbound direction/status and completed state', () => {
    const p = buildPhonecall({ direction: 'inbound', phoneNumber: '+1555' }, cfg);
    expect(p.directioncode).toBe(0);
    expect(p.statecode).toBe(1);
    expect(p.statuscode).toBe(4);
    expect(p.phonenumber).toBe('+1555');
    expect(p.subject).toBeTruthy();
  });
  it('sets outbound direction/status', () => {
    const p = buildPhonecall({ direction: 'outbound' }, cfg);
    expect(p.directioncode).toBe(1);
    expect(p.statuscode).toBe(2);
  });
  it('binds regardingobjectid to the contact when contactId present', () => {
    const p = buildPhonecall({ direction: 'inbound', contactId: 'abc' }, cfg);
    expect(p['regardingobjectid_contact@odata.bind']).toBe('/contacts(abc)');
  });
  it('omits the regarding bind when no contactId', () => {
    const p = buildPhonecall({ direction: 'inbound' }, cfg);
    expect('regardingobjectid_contact@odata.bind' in p).toBe(false);
  });
  it('maps a known disposition code to its option-set value', () => {
    const p = buildPhonecall({ direction: 'inbound', dispositionCode: 'resolved' }, cfg);
    expect(p.new_disposition).toBe(100000001);
  });
  it('omits disposition field for an unknown code', () => {
    const p = buildPhonecall({ direction: 'inbound', dispositionCode: 'nope' }, cfg);
    expect('new_disposition' in p).toBe(false);
  });
  it('passes notes as description and rounds duration', () => {
    const p = buildPhonecall({ direction: 'inbound', notes: 'hi', durationMinutes: 3.7 }, cfg);
    expect(p.description).toBe('hi');
    expect(p.actualdurationminutes).toBe(4);
  });
  it('omits disposition for an inherited prototype key like "constructor"', () => {
    const p = buildPhonecall({ direction: 'inbound', dispositionCode: 'constructor' }, cfg);
    expect('new_disposition' in p).toBe(false);
  });
});
