export interface CifApi {
  searchAndOpenRecords(entityLogicalName: string, queryParameters: string, searchOnly: boolean, correlationId?: string, searchType?: number): Promise<string>;
  createRecord(entityLogicalName: string, data: string): Promise<string>;
  addHandler(eventName: string, handler: (eventData: any) => Promise<void>): void;
  openForm(entityFormOptions: string, formParameters?: string): Promise<string>;
}

export function getCif(): CifApi | undefined {
  return (window as any)?.Microsoft?.CIFramework as CifApi | undefined;
}
