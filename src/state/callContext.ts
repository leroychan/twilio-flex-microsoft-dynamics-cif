const contactByTask = new Map<string, string>();

export function setContactForTask(taskSid: string, contactId: string): void {
  contactByTask.set(taskSid, contactId);
}
export function getContactForTask(taskSid: string): string | undefined {
  return contactByTask.get(taskSid);
}
export function clearTask(taskSid: string): void {
  contactByTask.delete(taskSid);
}
