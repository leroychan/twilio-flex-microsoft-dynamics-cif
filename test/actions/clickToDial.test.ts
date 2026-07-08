import { wireClickToDial } from '../../src/actions/clickToDial';

describe('wireClickToDial', () => {
  it('invokes StartOutboundCall with the clicked number', () => {
    let captured: (phone: string) => void = () => {};
    const client = { onClickToDial: (h: (p: string) => void) => { captured = h; } };
    const invokeAction = jest.fn();
    wireClickToDial({ client, invokeAction });
    captured('+1999');
    expect(invokeAction).toHaveBeenCalledWith('StartOutboundCall', { destination: '+1999' });
  });
});
