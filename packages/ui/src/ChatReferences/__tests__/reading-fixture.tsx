import { createRoot } from 'react-dom/client';
import type { ChatMessage, Role } from '@pitchcrew/core';
import { ReferenceMessage } from '../components/ReferenceMessage.tsx';
import '@/styles.css';
import '@/styles/chat.css';

const words =
  'Keep the evidence, trade-offs and next action clear while the reply wraps naturally. '.repeat(8);
const content = `@career-coach Please review this plan.\n\n- **Bulleted lead:** ${words}\n\n  A second paragraph stays with its item.\n\n  - Nested evidence: ${words}\n\n10. **Ordered lead:** ${words}\n11. Another ordered item.\n\n- [x] Completed evidence\n- [ ] Pending evidence`;
const message = { id: 'reading', from: 'scout', content } as ChatMessage;
const catalog = { roles: [{ id: 'career-coach', name: 'Career Coach' } as Role], skills: [] };

createRoot(document.getElementById('root')!).render(
  <main
    className="chat-workspace"
    data-chat-width="comfortable"
    style={{ maxWidth: 736, margin: 'auto' }}
  >
    <div className="chat-message-content" style={{ padding: 20 }}>
      <ReferenceMessage message={message} catalog={catalog} streaming={false} />
    </div>
  </main>,
);
