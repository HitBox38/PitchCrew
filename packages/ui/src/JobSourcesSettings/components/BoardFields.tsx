import { Input } from '@/components/ui/input/components/Input.tsx';
import { boardExamples, boardHelp, boardLabels, tokenHelp, tokenProviders } from '../constants.ts';
import type { JobSourcesModel, SourceDraft } from '../types.ts';

/** The board identifier, plus the careers token for providers that need one. */
export function BoardFields({
  draft,
  setBoard,
  setToken,
}: Pick<JobSourcesModel, 'setBoard' | 'setToken'> & { draft: SourceDraft }) {
  const needsToken = tokenProviders.has(draft.provider);
  return (
    <div className={needsToken ? 'grid grid-cols-2 gap-3.5 max-compact:grid-cols-1' : 'grid'}>
      <label>
        {boardLabels[draft.provider]}
        <Input
          value={draft.slug}
          onChange={(event) => setBoard(event.target.value)}
          placeholder={boardExamples[draft.provider]}
          required
          maxLength={300}
        />
        <span className="quiet font-normal">{boardHelp[draft.provider]}</span>
      </label>
      {needsToken ? (
        <label>
          Careers token
          <Input
            value={draft.token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste the token"
            required
            maxLength={600}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="quiet font-normal">{tokenHelp}</span>
        </label>
      ) : null}
    </div>
  );
}
