import { CifApi, getCif } from './cifGlobal';
import { IntegrationConfig } from '../config/integrationConfig';
import { buildContactQuery, parseContactResults } from '../mappers/contactSearch';
import { buildPhonecall, CallContext } from '../mappers/phonecall';

export type ScreenPopAction = 'opened' | 'list' | 'quickCreate' | 'skipped';

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
      matches = parseContactResults(await cif.searchAndOpenRecords('contact', query, true));
    } catch {
      return { action: 'skipped' };
    }
    if (matches.length === 1) {
      await cif.searchAndOpenRecords('contact', query, false).catch(() => undefined);
      return { action: 'opened', contactId: matches[0].id };
    }
    if (matches.length === 0) {
      await this.quickCreateContact(phone);
      return { action: 'quickCreate' };
    }
    await cif.searchAndOpenRecords('contact', query, false).catch(() => undefined);
    return { action: 'list' };
  }

  async quickCreateContact(phone: string): Promise<void> {
    const cif = this.getCifFn();
    if (!cif) return;
    const field = this.cfg.contactSearchFields[0] ?? 'telephone1';
    const entityFormOptions = JSON.stringify({ entityName: 'contact', useQuickCreateForm: true });
    const formParameters = JSON.stringify({ [field]: phone });
    await cif.openForm(entityFormOptions, formParameters).catch(() => undefined);
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
