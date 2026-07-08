import { CifClient } from '../cif/CifClient';

export function wireClickToDial(deps: {
  client: Pick<CifClient, 'onClickToDial'>;
  invokeAction: (name: string, payload: Record<string, unknown>) => void;
}): void {
  deps.client.onClickToDial((phone) => {
    deps.invokeAction('StartOutboundCall', { destination: phone });
  });
}
