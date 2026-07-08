import { setContactForTask, getContactForTask, clearTask } from '../../src/state/callContext';

describe('callContext', () => {
  it('stores and retrieves a contact id by task sid', () => {
    setContactForTask('WT1', 'c1');
    expect(getContactForTask('WT1')).toBe('c1');
  });
  it('returns undefined for unknown or cleared tasks', () => {
    setContactForTask('WT2', 'c2');
    clearTask('WT2');
    expect(getContactForTask('WT2')).toBeUndefined();
    expect(getContactForTask('nope')).toBeUndefined();
  });
});
