export interface StoredContact { id: string; name?: string }

const contactByTask = new Map<string, StoredContact>();
const subscribers = new Map<string, Set<() => void>>();

function notify(taskSid: string): void {
  subscribers.get(taskSid)?.forEach((cb) => {
    try { cb(); } catch { /* a bad subscriber must not break storage */ }
  });
}

export function setContactForTask(taskSid: string, contact: StoredContact): void {
  contactByTask.set(taskSid, contact);
  notify(taskSid);
}
export function getContactForTask(taskSid: string): StoredContact | undefined {
  return contactByTask.get(taskSid);
}
export function clearTask(taskSid: string): void {
  contactByTask.delete(taskSid);
  notify(taskSid);
}

/**
 * Subscribe to contact changes for a task. The screen pop stores the contact
 * asynchronously (after the CIF search resolves), so UI reading this store must
 * re-render on change rather than snapshot once. Returns an unsubscribe fn.
 */
export function subscribeContact(taskSid: string, cb: () => void): () => void {
  let set = subscribers.get(taskSid);
  if (!set) { set = new Set(); subscribers.set(taskSid, set); }
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) subscribers.delete(taskSid);
  };
}
