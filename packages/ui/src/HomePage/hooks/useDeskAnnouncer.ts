import { useCallback, useState } from 'react';

const sentence = (text: string) => (/[.!?…]$/.test(text) ? text : `${text}.`);

/**
 * The desk's one polite live region. It says each desk decision that leaves a record once, with
 * what opens next, in place of the embedded component's success toast (`deskAction` drops it for
 * such a call). The same words twice in a row still change the region, so a repeated outcome is
 * read again.
 */
export const useDeskAnnouncer = () => {
  const [said, setSaid] = useState('');
  const say = useCallback((text: string, next?: { subject: string; kind: string }) => {
    const words = [sentence(text), next ? `Next: ${next.subject}, ${next.kind}.` : '']
      .filter(Boolean)
      .join(' ');
    setSaid((current) => (current === words ? `${words}​` : words));
  }, []);
  return { said, say };
};
