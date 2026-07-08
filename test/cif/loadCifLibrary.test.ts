import { loadCifLibrary } from '../../src/cif/loadCifLibrary';

describe('loadCifLibrary', () => {
  it('short-circuits true when CIF is already present', async () => {
    const inject = jest.fn();
    const ok = await loadCifLibrary({ isReady: () => true, injectScript: inject, getCrmUrl: () => 'https://x' });
    expect(ok).toBe(true);
    expect(inject).not.toHaveBeenCalled();
  });
  it('injects the library from the CRM origin and resolves true when it becomes ready', async () => {
    let ready = false;
    const inject = jest.fn().mockImplementation(async () => { ready = true; });
    const ok = await loadCifLibrary({
      isReady: () => ready,
      injectScript: inject,
      getCrmUrl: () => 'https://org.crm.dynamics.com',
      timeoutMs: 1000,
    });
    expect(ok).toBe(true);
    expect(inject).toHaveBeenCalledWith('https://org.crm.dynamics.com/webresources/Widget/msdyn_ciLibrary.js');
  });
  it('resolves false when the CRM url cannot be derived', async () => {
    const ok = await loadCifLibrary({ isReady: () => false, injectScript: jest.fn(), getCrmUrl: () => undefined });
    expect(ok).toBe(false);
  });
  it('resolves false on timeout', async () => {
    const ok = await loadCifLibrary({
      isReady: () => false,
      injectScript: jest.fn().mockResolvedValue(undefined),
      getCrmUrl: () => 'https://org.crm.dynamics.com',
      timeoutMs: 50,
    });
    expect(ok).toBe(false);
  });
});
