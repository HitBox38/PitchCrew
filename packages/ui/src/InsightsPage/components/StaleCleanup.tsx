import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { useStaleCleanup } from '../hooks/useStaleCleanup.ts';
import { StaleConfirm } from './StaleConfirm.tsx';
import { StaleList } from './StaleList.tsx';

export function StaleCleanup() {
  const stale = useStaleCleanup();
  return (
    <div>
      <h3>Silent applications</h3>
      <p className="quiet">
        Find submitted jobs with no status change for a number of days, then choose which ones to
        mark as no response. Nothing changes until you confirm. If a company replies later, move the
        job forward from its details.
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
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
}
