import { useState } from 'react';
import type { RuntimeId } from '@pitchcrew/core';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@pitchcrew/design-system/accordion';
import { ConnectionEditor } from './components/ConnectionEditor.tsx';

export const RuntimeConnectionSettings = (props: {
  runtime: RuntimeId;
  blocked: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onWorkingChange: (working: boolean) => void;
  onSaved: () => void;
  recovery?: boolean;
}) => {
  const [visited, setVisited] = useState(!!props.recovery);
  const [open, setOpen] = useState(!!props.recovery);
  const [recovery, setRecovery] = useState(!!props.recovery);
  if (!!props.recovery !== recovery) {
    setRecovery(!!props.recovery);
    if (props.recovery) {
      setVisited(true);
      setOpen(true);
    }
  }
  return (
    <Accordion
      value={open ? ['credentials'] : []}
      onValueChange={(value) => {
        const open = value.includes('credentials');
        setOpen(open);
        if (open) setVisited(true);
      }}
    >
      <AccordionItem value="credentials">
        <AccordionTrigger>
          <span>Credentials and provider settings</span>
        </AccordionTrigger>
        <AccordionContent keepMounted>
          {visited ? <ConnectionEditor {...props} /> : null}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
