import * as Flex from '@twilio/flex-ui';
import { FlexPlugin } from '@twilio/flex-plugin';

const PLUGIN_NAME = 'DynamicsCifPlugin';

export default class DynamicsCifPlugin extends FlexPlugin {
  constructor() {
    super(PLUGIN_NAME);
  }

  /**
   * This code is run when your plugin is being started.
   * Task 11 will wire up the full Dynamics CIF integration here.
   *
   * @param flex { typeof Flex }
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async init(_flex: typeof Flex, _manager: Flex.Manager): Promise<void> {
    // intentionally empty — Task 11 implements this
  }
}
