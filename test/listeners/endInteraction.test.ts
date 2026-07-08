import { handleCompleteTask, EndInteractionDeps } from '../../src/listeners/endInteraction';
import { getConfig } from '../../src/config/integrationConfig';

const cfg = getConfig({ dispositionMap: { resolved: 'Resolved' } });

function baseDeps(over: Partial<EndInteractionDeps> = {}): EndInteractionDeps {
  return {
    client: { createNote: jest.fn().mockResolvedValue('note1') },
    cfg,
    getContact: jest.fn().mockReturnValue({ id: 'c1', name: 'Jane' }),
    clear: jest.fn(),
    fetchVoiceTranscript: jest.fn().mockResolvedValue('Customer: Hi\nAgent: Hello'),
    fetchChatTranscript: jest.fn().mockResolvedValue('Customer: hey'),
    agentName: 'Agent Smith',
    ...over,
  };
}

describe('handleCompleteTask', () => {
  it('voice: reads the RTT transcript by call_sid and writes a note bound to the contact', async () => {
    const deps = baseDeps();
    await handleCompleteTask(
      { task: { sid: 'WT1', taskChannelUniqueName: 'voice', attributes: { call_sid: 'CA9', caller: '+1424', disposition: 'resolved', wrapUpNotes: 'ok' } } },
      deps,
    );
    expect(deps.fetchVoiceTranscript).toHaveBeenCalledWith('CA9');
    const payload = (deps.client.createNote as jest.Mock).mock.calls[0][0];
    expect(payload['objectid_contact@odata.bind']).toBe('/contacts(c1)');
    expect(payload.notetext).toContain('Disposition: Resolved');
    expect(payload.notetext).toContain('Customer: Hi');
    expect(deps.clear).toHaveBeenCalledWith('WT1');
  });

  it('whatsapp: resolves via channelType and reads the chat transcript from the conversation', async () => {
    const deps = baseDeps();
    await handleCompleteTask(
      { task: { sid: 'WT2', taskChannelUniqueName: 'chat', attributes: { channelType: 'whatsapp', conversationSid: 'CH1', customerAddress: 'whatsapp:+6590100209' } } },
      deps,
    );
    expect(deps.fetchChatTranscript).toHaveBeenCalled();
    expect(deps.fetchVoiceTranscript).not.toHaveBeenCalled();
    const payload = (deps.client.createNote as jest.Mock).mock.calls[0][0];
    expect(payload.notetext).toContain('Customer: hey');
  });

  it('skips channels not in config (no note, no clear)', async () => {
    const deps = baseDeps();
    await handleCompleteTask(
      { task: { sid: 'WT3', taskChannelUniqueName: 'sms', attributes: {} } },
      deps,
    );
    expect(deps.client.createNote).not.toHaveBeenCalled();
    expect(deps.clear).not.toHaveBeenCalled();
  });

  it('still clears the task if createNote rejects', async () => {
    const deps = baseDeps({ client: { createNote: jest.fn().mockRejectedValue(new Error('boom')) } });
    await expect(
      handleCompleteTask({ task: { sid: 'WT4', taskChannelUniqueName: 'voice', attributes: { call_sid: 'CA1' } } }, deps),
    ).rejects.toThrow('boom');
    expect(deps.clear).toHaveBeenCalledWith('WT4');
  });
});
