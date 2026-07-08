import { CifClient } from '../../src/cif/CifClient';
import { getConfig } from '../../src/config/integrationConfig';
import type { CifApi } from '../../src/cif/cifGlobal';

function fakeCif(overrides: Partial<CifApi> = {}): CifApi {
  return {
    searchAndOpenRecords: jest.fn().mockResolvedValue('[]'),
    createRecord: jest.fn().mockResolvedValue(JSON.stringify({ id: 'pc1' })),
    addHandler: jest.fn(),
    openForm: jest.fn().mockResolvedValue(''),
    ...overrides,
  };
}
const cfg = getConfig();

describe('CifClient.isAvailable', () => {
  it('is false when the CIF global is absent', () => {
    expect(new CifClient(cfg, () => undefined).isAvailable()).toBe(false);
  });
});

describe('CifClient.screenPop', () => {
  it('opens the single matching contact and returns its id', async () => {
    const cif = fakeCif({
      searchAndOpenRecords: jest.fn()
        .mockResolvedValueOnce(JSON.stringify([{ contactid: 'c1', fullname: 'Jane' }])) // searchOnly=true
        .mockResolvedValueOnce('[]'), // open
    });
    const res = await new CifClient(cfg, () => cif).screenPop('+1555');
    expect(res).toEqual({ action: 'opened', contactId: 'c1', contactName: 'Jane' });
    expect((cif.searchAndOpenRecords as jest.Mock).mock.calls[0][2]).toBe(true);
    expect((cif.searchAndOpenRecords as jest.Mock).mock.calls[1][2]).toBe(false);
  });
  it('opens the contact search page on zero matches (no quick-create flyout)', async () => {
    const cif = fakeCif({ searchAndOpenRecords: jest.fn().mockResolvedValue('[]') });
    const res = await new CifClient(cfg, () => cif).screenPop('+1555');
    expect(res.action).toBe('search');
    // second call opens the search page with searchOnly=false; no openForm flyout
    expect((cif.searchAndOpenRecords as jest.Mock).mock.calls[1][2]).toBe(false);
    expect(cif.openForm).not.toHaveBeenCalled();
  });
  it('opens a list on multiple matches', async () => {
    const cif = fakeCif({
      searchAndOpenRecords: jest.fn()
        .mockResolvedValueOnce(JSON.stringify([{ contactid: 'a' }, { contactid: 'b' }]))
        .mockResolvedValueOnce('[]'),
    });
    const res = await new CifClient(cfg, () => cif).screenPop('+1555');
    expect(res.action).toBe('list');
  });
  it('skips when phone is empty', async () => {
    const cif = fakeCif();
    const res = await new CifClient(cfg, () => cif).screenPop('');
    expect(res.action).toBe('skipped');
    expect(cif.searchAndOpenRecords).not.toHaveBeenCalled();
  });
  it('skips when CIF is unavailable', async () => {
    const res = await new CifClient(cfg, () => undefined).screenPop('+1555');
    expect(res.action).toBe('skipped');
  });
});

describe('CifClient.createNote', () => {
  it('creates an annotation and returns the new id', async () => {
    const cif = fakeCif();
    const id = await new CifClient(cfg, () => cif).createNote({
      subject: 'Inbound voice',
      'objectid_contact@odata.bind': '/contacts(c1)',
    });
    expect(id).toBe('pc1');
    const [entity, data] = (cif.createRecord as jest.Mock).mock.calls[0];
    expect(entity).toBe('annotation');
    expect(JSON.parse(data)['objectid_contact@odata.bind']).toBe('/contacts(c1)');
  });
  it('returns undefined and does not throw on createRecord failure', async () => {
    const cif = fakeCif({ createRecord: jest.fn().mockRejectedValue(new Error('boom')) });
    const id = await new CifClient(cfg, () => cif).createNote({ subject: 'x' });
    expect(id).toBeUndefined();
  });
});

describe('CifClient.openCaseForm', () => {
  it('opens an unsaved incident quick-create prefilled with the contact', async () => {
    const cif = fakeCif();
    await new CifClient(cfg, () => cif).openCaseForm('c1', 'Jane');
    const [opts, params] = (cif.openForm as jest.Mock).mock.calls[0];
    expect(JSON.parse(opts)).toEqual({ entityName: 'incident', useQuickCreateForm: true });
    expect(JSON.parse(params)).toEqual({ customerid: 'c1', customeridname: 'Jane', customeridtype: 'contact' });
  });
  it('does nothing without a contactId', async () => {
    const cif = fakeCif();
    await new CifClient(cfg, () => cif).openCaseForm('');
    expect(cif.openForm).not.toHaveBeenCalled();
  });
});

describe('CifClient.onClickToDial', () => {
  it('registers an onclicktoact handler that forwards the value', async () => {
    const cif = fakeCif();
    const client = new CifClient(cfg, () => cif);
    const spy = jest.fn();
    client.onClickToDial(spy);
    expect((cif.addHandler as jest.Mock).mock.calls[0][0]).toBe('onclicktoact');
    const handler = (cif.addHandler as jest.Mock).mock.calls[0][1];
    await handler({ value: '+1999', name: 'telephone1', format: 'phone', entityLogicalName: 'contact' });
    expect(spy).toHaveBeenCalledWith('+1999');
  });
});
