import { Button } from '@pitchcrew/design-system/button';
import { Input } from '@pitchcrew/design-system/input';
import { GithubInstructions } from './GithubInstructions.tsx';
import type { ConnectAccountDialogProps } from '../types.ts';

export const GithubTokenForm = ({
  connect,
  token,
  setToken,
  working,
}: ConnectAccountDialogProps) => {
  return (
    <form className="form mt-3 flex flex-col gap-3" onSubmit={(e) => void connect(e)}>
      <GithubInstructions />
      <label>
        GitHub access token
        <Input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
          required
          maxLength={1000}
        />
      </label>
      <Button className="button primary self-start" type="submit" disabled={working}>
        {working ? 'Connecting…' : 'Connect with token'}
      </Button>
    </form>
  );
};
