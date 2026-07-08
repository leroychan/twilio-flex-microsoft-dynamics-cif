import * as React from 'react';
import * as Flex from '@twilio/flex-ui';
import { FlexPlugin } from '@twilio/flex-plugin';

import { getConfig } from './config/integrationConfig';
import type { IntegrationConfig } from './config/integrationConfig';
import { CifClient } from './cif/CifClient';
import { loadCifLibrary } from './cif/loadCifLibrary';
import { handleAcceptTask } from './listeners/screenPop';
import { handleCompleteTask } from './listeners/endInteraction';
import { wireClickToDial } from './actions/clickToDial';
import { setContactForTask, getContactForTask, clearTask } from './state/callContext';
import { CreateCaseButton } from './components/CreateCaseButton';
import { fetchVoiceTranscript, fetchChatTranscript } from './runtime/transcriptSources';

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

    // Diagnostic: enumerate the CIF framework API surface so we can confirm what's available.
    try {
      const g = (window as any).Microsoft?.CIFramework;
      // eslint-disable-next-line no-console
      console.info(
        '[DynamicsCif] CIFramework present:', !!g,
        '\n[DynamicsCif] CIFramework members:', g ? Object.getOwnPropertyNames(g) : 'n/a',
        '\n[DynamicsCif] effective config:', cfg,
      );
    } catch {
      /* diagnostics only */
    }

    if (!ready || !client.isAvailable()) {
      // Not running inside a CIF host (e.g. standalone Flex) — degrade gracefully.
      // eslint-disable-next-line no-console
      console.warn(`${PLUGIN_NAME}: CIF not available; screen pop / call logging disabled.`);
      return;
    }

    const agentName =
      (manager.workerClient?.attributes as any)?.full_name ?? manager.user?.identity;

    // Fire-and-forget: these listeners do best-effort side effects (screen pop, timeline
    // note). They must NEVER return their promise to the action framework — a slow CIF
    // call (createRecord's timeout is 100s) or a stalled Sync read would otherwise hold up
    // AcceptTask/CompleteTask and make it look like the agent "can't end the call".
    flex.Actions.addListener('afterAcceptTask', (payload) => {
      void handleAcceptTask(payload as any, { client, cfg, store: setContactForTask }).catch(
        // eslint-disable-next-line no-console
        (e) => console.error('[DynamicsCif] screen-pop failed', e),
      );
    });

    flex.Actions.addListener('afterCompleteTask', (payload) => {
      void handleCompleteTask(payload as any, {
        client,
        cfg,
        getContact: getContactForTask,
        clear: clearTask,
        fetchVoiceTranscript,
        fetchChatTranscript,
        agentName,
      }).catch(
        // eslint-disable-next-line no-console
        (e) => console.error('[DynamicsCif] end-interaction failed', e),
      );
    });

    wireClickToDial({
      client,
      invokeAction: (name, p) => { void flex.Actions.invokeAction(name, p as any); },
    });

    // Agent-triggered ticket creation, mounted on the task header (the CRM container /
    // panel 2 is hidden above). Flex injects the selected task as a prop.
    flex.TaskCanvasHeader.Content.add(
      <CreateCaseButton key="dynamics-create-case" client={client} />,
      { sortOrder: 1, align: 'end' },
    );
  }
}
