import { handleAcceptTask } from '../../src/listeners/screenPop';
import { getConfig } from '../../src/config/integrationConfig';

const cfg = getConfig();

describe('handleAcceptTask', () => {
  it('pops using the voice caller attribute and stores id + name', async () => {
    const client = { screenPop: jest.fn().mockResolvedValue({ action: 'opened', contactId: 'c1', contactName: 'Jane' }) };
    const store = jest.fn();
    await handleAcceptTask({ task: { sid: 'WT1', attributes: { caller: '+1555' }, taskChannelUniqueName: 'voice' } }, { client, cfg, store });
    expect(client.screenPop).toHaveBeenCalledWith('+1555');
    expect(store).toHaveBeenCalledWith('WT1', { id: 'c1', name: 'Jane' });
  });

  it('handles whatsapp using the "from" attribute and strips the channel prefix', async () => {
    const client = { screenPop: jest.fn().mockResolvedValue({ action: 'opened', contactId: 'c2' }) };
    const store = jest.fn();
    await handleAcceptTask({ task: { sid: 'WT2', attributes: { from: 'whatsapp:+1424' }, taskChannelUniqueName: 'whatsapp' } }, { client, cfg, store });
    expect(client.screenPop).toHaveBeenCalledWith('+1424');
    expect(store).toHaveBeenCalledWith('WT2', { id: 'c2', name: undefined });
  });

  it('does not store when no contact was opened', async () => {
    const client = { screenPop: jest.fn().mockResolvedValue({ action: 'search' }) };
    const store = jest.fn();
    await handleAcceptTask({ task: { sid: 'WT3', attributes: { caller: '+1555' }, taskChannelUniqueName: 'voice' } }, { client, cfg, store });
    expect(store).not.toHaveBeenCalled();
  });

  it('skips channels not present in the config', async () => {
    const client = { screenPop: jest.fn() };
    const store = jest.fn();
    await handleAcceptTask({ task: { sid: 'WT4', attributes: { caller: '+1555' }, taskChannelUniqueName: 'sms' } }, { client, cfg, store });
    expect(client.screenPop).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
  });
});
