import { CifApi, getCif } from './cifGlobal';
import { IntegrationConfig } from '../config/integrationConfig';
import { buildContactQuery, parseContactResults } from '../mappers/contactSearch';

export type ScreenPopAction = 'opened' | 'list' | 'search' | 'skipped';

export class CifClient {
  constructor(
    private readonly cfg: IntegrationConfig,
    private readonly getCifFn: () => CifApi | undefined = getCif,
  ) {}

  isAvailable(): boolean {
    return !!this.getCifFn();
  }

  async screenPop(
    phone: string,
  ): Promise<{ action: ScreenPopAction; contactId?: string; contactName?: string }> {
    const cif = this.getCifFn();
    if (!cif || !phone) return { action: 'skipped' };
    const query = buildContactQuery(phone, this.cfg.contactSearchFields);
    let matches;
    try {
      const raw = await cif.searchAndOpenRecords('contact', query, true);
      // eslint-disable-next-line no-console
      console.info('[DynamicsCif] search query:', query, '\n[DynamicsCif] raw result:', raw);
      matches = parseContactResults(raw);
      // eslint-disable-next-line no-console
      console.info('[DynamicsCif] parsed matches:', matches.length, matches);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[DynamicsCif] search failed:', e);
      return { action: 'skipped' };
    }
    if (matches.length === 1) {
      await cif.searchAndOpenRecords('contact', query, false).catch(() => undefined);
      return { action: 'opened', contactId: matches[0].id, contactName: matches[0].fullname };
    }
    if (matches.length === 0) {
      // No match: open the contact search page in the main Dynamics area (searchOnly=false),
      // rather than a quick-create form flyout that would overlay the docked CIF/Flex panel.
      await cif.searchAndOpenRecords('contact', query, false).catch(() => undefined);
      return { action: 'search' };
    }
    await cif.searchAndOpenRecords('contact', query, false).catch(() => undefined);
    return { action: 'list' };
  }

  /** Create a timeline note (annotation). Never throws — logging must not block wrap-up. */
  async createNote(payload: Record<string, unknown>): Promise<string | undefined> {
    const cif = this.getCifFn();
    if (!cif) return undefined;
    try {
      const raw = await cif.createRecord('annotation', JSON.stringify(payload));
      return JSON.parse(raw)?.id;
    } catch {
      return undefined;
    }
  }

  /** Open a pre-filled, UNSAVED Case (incident) quick-create form for the contact. */
  async openCaseForm(contactId: string, contactName?: string): Promise<void> {
    const cif = this.getCifFn();
    if (!cif || !contactId) return;
    const entityFormOptions = JSON.stringify({ entityName: 'incident', useQuickCreateForm: true });
    const formParameters = JSON.stringify({
      customerid: contactId,
      customeridname: contactName ?? '',
      customeridtype: 'contact',
    });
    await cif.openForm(entityFormOptions, formParameters).catch(() => undefined);
  }

  onClickToDial(handler: (phone: string) => void): void {
    const cif = this.getCifFn();
    if (!cif) return;
    cif.addHandler('onclicktoact', async (eventData: { value?: string }) => {
      if (eventData?.value) handler(eventData.value);
    });
  }
}
