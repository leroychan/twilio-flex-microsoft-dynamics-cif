import * as React from 'react';
import * as Flex from '@twilio/flex-ui';
import { Button } from '@twilio-paste/core/button';

import { CifClient } from '../cif/CifClient';
import { getContactForTask, subscribeContact, StoredContact } from '../state/callContext';

interface Props {
  client: Pick<CifClient, 'openCaseForm'>;
  /** Injected by withTaskContext — the task this header belongs to. */
  task?: Flex.ITask;
}

/**
 * Agent-triggered action: open a pre-filled, UNSAVED Case (incident) quick-create form
 * for the contact resolved during screen pop. Disabled until a contact is known.
 *
 * - Wrapped in withTaskContext so it reliably receives the current `task` (components
 *   added to TaskCanvasHeader.Content are NOT guaranteed a `task` prop otherwise).
 * - The contact is stored asynchronously by the screen-pop listener (keyed by task.sid,
 *   the same sid we read here) after the CIF search resolves, so we subscribe to the store
 *   and re-render when it lands — a one-time snapshot would leave the button greyed out.
 */
const CreateCaseButtonImpl: React.FC<Props> = ({ client, task }) => {
  const taskSid = task?.sid;
  const [contact, setContact] = React.useState<StoredContact | undefined>(
    () => (taskSid ? getContactForTask(taskSid) : undefined),
  );

  React.useEffect(() => {
    if (!taskSid) {
      setContact(undefined);
      return;
    }
    const current = getContactForTask(taskSid); // catch a contact stored before this effect ran
    setContact(current);
    // eslint-disable-next-line no-console
    console.info('[DynamicsCif] CreateCaseButton mounted', { taskSid, contact: current });
    return subscribeContact(taskSid, () => {
      const next = getContactForTask(taskSid);
      // eslint-disable-next-line no-console
      console.info('[DynamicsCif] CreateCaseButton contact update', { taskSid, contact: next });
      setContact(next);
    });
  }, [taskSid]);

  const onClick = React.useCallback(() => {
    if (contact?.id) void client.openCaseForm(contact.id, contact.name);
  }, [client, contact]);

  return (
    <Button variant="secondary" size="small" disabled={!contact?.id} onClick={onClick}>
      Create Case
    </Button>
  );
};

export const CreateCaseButton = Flex.withTaskContext(CreateCaseButtonImpl);
