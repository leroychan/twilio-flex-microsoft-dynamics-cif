import { handleCompleteTask } from '../../src/listeners/logCall';
import { getConfig } from '../../src/config/integrationConfig';

const cfg = getConfig();

describe('handleCompleteTask', () => {
  it('logs a call with attributes + stored contact, then clears the task', async () => {
    const client = { logCall: jest.fn().mockResolvedValue('pc1') };
    const clear = jest.fn();
    const attributes = {
      [cfg.attr.callerNumber]: '+1555',
      [cfg.attr.direction]: 'inbound',
      [cfg.attr.disposition]: 'resolved',
      [cfg.attr.notes]: 'all good',
    };
    await handleCompleteTask({ task: { sid: 'WT1', attributes } }, { client, cfg, getContact: () => 'c1', clear });
    const ctx = (client.logCall as jest.Mock).mock.calls[0][0];
    expect(ctx).toMatchObject({ direction: 'inbound', phoneNumber: '+1555', dispositionCode: 'resolved', notes: 'all good', contactId: 'c1' });
    expect(clear).toHaveBeenCalledWith('WT1');
  });
  it('defaults direction to inbound when attribute missing', async () => {
    const client = { logCall: jest.fn().mockResolvedValue(undefined) };
    await handleCompleteTask({ task: { sid: 'WT2', attributes: {} } }, { client, cfg, getContact: () => undefined, clear: jest.fn() });
    expect((client.logCall as jest.Mock).mock.calls[0][0].direction).toBe('inbound');
  });
});
