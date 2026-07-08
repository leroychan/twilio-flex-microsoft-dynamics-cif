import * as React from 'react';
import { Button } from '@twilio-paste/core/button';

import { CifClient } from '../cif/CifClient';
import { getContactForTask, subscribeContact, StoredContact } from '../state/callContext';

interface Props {
  client: Pick<CifClient, 'openCaseForm'>;
  /** The Flex task this button is rendered for (Flex injects the selected task). */
  task?: { taskSid?: string; sid?: string };
}

/**
 * Agent-triggered action: open a pre-filled, UNSAVED Case (incident) quick-create form
 * for the contact resolved during screen pop. Disabled until a contact is known.
 *
 * The contact is stored asynchronously by the screen-pop listener (after the CIF search
 * resolves), so we subscribe to the store and re-render when it lands — a one-time snapshot
 * would leave the button permanently greyed out.
 */
export const CreateCaseButton: React.FC<Props> = ({ client, task }) => {
  const taskSid = task?.taskSid ?? task?.sid;
  const [contact, setContact] = React.useState<StoredContact | undefined>(
    () => (taskSid ? getContactForTask(taskSid) : undefined),
  );

  React.useEffect(() => {
    if (!taskSid) {
      setContact(undefined);
      return;
    }
    setContact(getContactForTask(taskSid)); // catch a contact stored before this effect ran
    return subscribeContact(taskSid, () => setContact(getContactForTask(taskSid)));
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
