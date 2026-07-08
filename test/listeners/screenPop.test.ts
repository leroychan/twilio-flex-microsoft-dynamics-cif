import { handleAcceptTask } from '../../src/listeners/screenPop';
import { getConfig } from '../../src/config/integrationConfig';

const cfg = getConfig();

describe('handleAcceptTask', () => {
  it('pops using the caller attribute and stores the resolved contact id', async () => {
    const client = { screenPop: jest.fn().mockResolvedValue({ action: 'opened', contactId: 'c1' }) };
    const store = jest.fn();
    await handleAcceptTask({ task: { sid: 'WT1', attributes: { [cfg.attr.callerNumber]: '+1555' } } }, { client, cfg, store });
    expect(client.screenPop).toHaveBeenCalledWith('+1555');
    expect(store).toHaveBeenCalledWith('WT1', 'c1');
  });
  it('does not store when no contact was opened', async () => {
    const client = { screenPop: jest.fn().mockResolvedValue({ action: 'quickCreate' }) };
    const store = jest.fn();
    await handleAcceptTask({ task: { sid: 'WT2', attributes: { [cfg.attr.callerNumber]: '+1555' } } }, { client, cfg, store });
    expect(store).not.toHaveBeenCalled();
  });
});
