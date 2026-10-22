import { Mail, MailOpen, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { timeAgo } from '@/lib/time.ts';
import { attachmentFiles } from '@/FileViewer/attachments.ts';
import { requestIdentity } from '../helpers.ts';
import { requestStatus } from '../status.ts';
import { saveInboxPreference } from '../hooks/preferences.ts';
import type { ApprovalRequest, InboxViewModel } from '../types.ts';
export const InboxRow = ({
  request,
  model,
}: {
  request: ApprovalRequest;
  model: InboxViewModel;
}) => {
  const { sender, subject, context } = requestIdentity(request, model.data);
  const unread = !model.readIds.includes(request.key);
  const files = attachmentFiles(request);
  return (
    <div className="mail-row" data-unread={unread}>
      <Button
        className="mail-row-open"
        variant="ghost"
        data-request-key={request.key}
        onClick={() => {
          saveInboxPreference('last-row', request.key);
          model.selectRequest(request.key);
        }}
      >
        <RoleAvatar agentRole={request.kind === 'browser' ? request.approval.roleId : 'system'} />
        <span className="mail-sender">
          {unread ? <span className="unread-dot" /> : null}
          {sender}
        </span>
        <span className="mail-summary">
          <strong>{subject}</strong>
          <span>{context}</span>
        </span>
        <span className="mail-status">{requestStatus(request, model.data)}</span>
        {files.length ? (
          <span className="mail-file-count">
            <Paperclip size={14} />
            {files.length}
          </span>
        ) : null}
        <time dateTime={request.approval.createdAt}>{timeAgo(request.approval.createdAt)}</time>
      </Button>
      <Button
        className="mail-read-toggle"
        size="icon"
        variant="ghost"
        aria-label={`Mark ${subject} ${unread ? 'read' : 'unread'}`}
        onClick={() => model.markRead(request.key, unread)}
      >
        {unread ? <MailOpen size={16} /> : <Mail size={16} />}
      </Button>
    </div>
  );
};
