import {
  setContactForTask,
  getContactForTask,
  clearTask,
  subscribeContact,
} from '../../src/state/callContext';

describe('callContext', () => {
  it('stores and retrieves a contact by task sid', () => {
    setContactForTask('WT1', { id: 'c1', name: 'Jane' });
    expect(getContactForTask('WT1')).toEqual({ id: 'c1', name: 'Jane' });
  });
  it('returns undefined for unknown or cleared tasks', () => {
    setContactForTask('WT2', { id: 'c2' });
    clearTask('WT2');
    expect(getContactForTask('WT2')).toBeUndefined();
    expect(getContactForTask('nope')).toBeUndefined();
  });
  it('notifies subscribers when the contact is set or cleared', () => {
    const cb = jest.fn();
    const unsub = subscribeContact('WT3', cb);
    setContactForTask('WT3', { id: 'c3' });
    expect(cb).toHaveBeenCalledTimes(1);
    clearTask('WT3');
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    setContactForTask('WT3', { id: 'c3again' });
    expect(cb).toHaveBeenCalledTimes(2); // no more calls after unsubscribe
  });
  it('does not notify subscribers of other tasks', () => {
    const cb = jest.fn();
    subscribeContact('WT4', cb);
    setContactForTask('WT5', { id: 'c5' });
    expect(cb).not.toHaveBeenCalled();
  });
});
