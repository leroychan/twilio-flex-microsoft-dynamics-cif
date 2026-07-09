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

  it('handles whatsapp via attributes.channelType using customerAddress and strips the prefix', async () => {
    const client = { screenPop: jest.fn().mockResolvedValue({ action: 'opened', contactId: 'c2' }) };
    const store = jest.fn();
    // Real WhatsApp interaction task: taskChannelUniqueName is 'chat', channelType is 'whatsapp'.
    await handleAcceptTask(
      { task: { sid: 'WT2', attributes: { channelType: 'whatsapp', customerAddress: 'whatsapp:+6590100209' }, taskChannelUniqueName: 'chat' } },
      { client, cfg, store },
    );
    expect(client.screenPop).toHaveBeenCalledWith('+6590100209');
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
