import { Button } from '@pitchcrew/design-system/button';
import { Input } from '@pitchcrew/design-system/input';
import { useStaleCleanup } from '../hooks/useStaleCleanup.ts';
import { StaleConfirm } from './StaleConfirm.tsx';
import { StaleList } from './StaleList.tsx';

export const StaleCleanup = () => {
  const stale = useStaleCleanup();
  return (
    <div className="insights-tidy-part">
      <h3>Silent applications</h3>
      <p className="insights-note">
        Submitted jobs with no status change for a number of days. Nothing changes until you
        confirm; a later reply can still move a job forward.
      </p>
      <div className="insights-tidy-row">
        <label className="field">
          Days without a status change
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={stale.days}
            onChange={(event) => stale.setDays(event.target.value)}
          />
        </label>
        <Button
          className="button"
          disabled={!stale.validDays || stale.loading}
          onClick={() => void stale.load()}
        >
          {stale.loading ? 'Checking…' : 'Find silent applications'}
        </Button>
      </div>
      {stale.error ? (
        <p role="alert" className="form-error">
          {stale.error}
        </p>
      ) : null}
      {stale.preview ? <StaleList stale={stale} /> : null}
      {stale.confirming ? <StaleConfirm stale={stale} /> : null}
    </div>
  );
};
