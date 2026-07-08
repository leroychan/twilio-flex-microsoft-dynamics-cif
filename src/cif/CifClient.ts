import { CifApi, getCif } from './cifGlobal';
import { IntegrationConfig } from '../config/integrationConfig';
import { buildContactQuery, parseContactResults } from '../mappers/contactSearch';
import { buildPhonecall, CallContext } from '../mappers/phonecall';

export type ScreenPopAction = 'opened' | 'list' | 'search' | 'skipped';

export class CifClient {
  constructor(
    private readonly cfg: IntegrationConfig,
    private readonly getCifFn: () => CifApi | undefined = getCif,
  ) {}

  isAvailable(): boolean {
    return !!this.getCifFn();
  }

  async screenPop(phone: string): Promise<{ action: ScreenPopAction; contactId?: string }> {
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
      return { action: 'opened', contactId: matches[0].id };
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

  async logCall(ctx: CallContext): Promise<string | undefined> {
    const cif = this.getCifFn();
    if (!cif) return undefined;
    const payload = buildPhonecall(ctx, {
      dispositionFieldName: this.cfg.dispositionFieldName,
      dispositionMap: this.cfg.dispositionMap,
    });
    try {
      const raw = await cif.createRecord('phonecall', JSON.stringify(payload));
      return JSON.parse(raw)?.id;
    } catch {
      return undefined;
    }
  }

  onClickToDial(handler: (phone: string) => void): void {
    const cif = this.getCifFn();
    if (!cif) return;
    cif.addHandler('onclicktoact', async (eventData: { value?: string }) => {
      if (eventData?.value) handler(eventData.value);
    });
  }
}
