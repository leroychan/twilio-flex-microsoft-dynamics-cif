import * as React from 'react';
import { Button } from '@twilio-paste/core/button';

import { CifClient } from '../cif/CifClient';
import { getContactForTask } from '../state/callContext';

interface Props {
  client: Pick<CifClient, 'openCaseForm'>;
  /** The Flex task this button is rendered for (Flex injects the selected task). */
  task?: { taskSid?: string; sid?: string };
}

/**
 * Agent-triggered action: open a pre-filled, UNSAVED Case (incident) quick-create form
 * for the contact resolved during screen pop. Disabled until a contact is known.
 */
export const CreateCaseButton: React.FC<Props> = ({ client, task }) => {
  const taskSid = task?.taskSid ?? task?.sid;
  const contact = taskSid ? getContactForTask(taskSid) : undefined;

  const onClick = React.useCallback(() => {
    if (contact?.id) void client.openCaseForm(contact.id, contact.name);
  }, [client, contact]);

  return (
    <Button variant="secondary" size="small" disabled={!contact?.id} onClick={onClick}>
      Create Case
    </Button>
  );
};
