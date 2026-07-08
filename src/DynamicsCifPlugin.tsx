import * as Flex from '@twilio/flex-ui';
import { FlexPlugin } from '@twilio/flex-plugin';

import { getConfig } from './config/integrationConfig';
import type { IntegrationConfig } from './config/integrationConfig';
import { CifClient } from './cif/CifClient';
import { loadCifLibrary } from './cif/loadCifLibrary';
import { handleAcceptTask } from './listeners/screenPop';
import { handleCompleteTask } from './listeners/logCall';
import { wireClickToDial } from './actions/clickToDial';
import { setContactForTask, getContactForTask, clearTask } from './state/callContext';

const PLUGIN_NAME = 'DynamicsCifPlugin';

export default class DynamicsCifPlugin extends FlexPlugin {
  constructor() {
    super(PLUGIN_NAME);
  }

  async init(flex: typeof Flex, manager: Flex.Manager): Promise<void> {
    // Embedded-in-Dynamics layout: the CIF panel is narrow, so drop the second agent-desktop
    // panel and the project switcher to reclaim space. Applied unconditionally (layout-only,
    // independent of CIF availability).
    (flex.AgentDesktopView.defaultProps as any).showPanel2 = false;
    flex.RootContainer.Content.remove('project-switcher');

    // Admins can set ui_attributes.dynamicsCif in the Flex Configuration service to tune the
    // integration without code changes, e.g.:
    //   { dispositionMap: { resolved: 100000001 }, attr: { disposition: 'wrapUpCode' } }
    const overrides =
      ((manager.serviceConfiguration as any)?.ui_attributes?.dynamicsCif ?? {}) as Partial<IntegrationConfig>;
    const cfg = getConfig(overrides);
    const ready = await loadCifLibrary();
    const client = new CifClient(cfg);

    if (!ready || !client.isAvailable()) {
      // Not running inside a CIF host (e.g. standalone Flex) — degrade gracefully.
      // eslint-disable-next-line no-console
      console.warn(`${PLUGIN_NAME}: CIF not available; screen pop / call logging disabled.`);
      return;
    }

    flex.Actions.addListener('afterAcceptTask', (payload) =>
      handleAcceptTask(payload as any, { client, cfg, store: setContactForTask }),
    );

    flex.Actions.addListener('afterCompleteTask', (payload) =>
      handleCompleteTask(payload as any, { client, cfg, getContact: getContactForTask, clear: clearTask }),
    );

    wireClickToDial({
      client,
      invokeAction: (name, p) => { void flex.Actions.invokeAction(name, p as any); },
    });
  }
}
