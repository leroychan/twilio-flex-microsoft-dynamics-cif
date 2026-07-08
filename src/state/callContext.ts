export interface StoredContact { id: string; name?: string }

const contactByTask = new Map<string, StoredContact>();

export function setContactForTask(taskSid: string, contact: StoredContact): void {
  contactByTask.set(taskSid, contact);
}
export function getContactForTask(taskSid: string): StoredContact | undefined {
  return contactByTask.get(taskSid);
}
export function clearTask(taskSid: string): void {
  contactByTask.delete(taskSid);
}
