import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { GithubInstructions } from './GithubInstructions.tsx';
import type { ConnectAccountDialogProps } from '../types.ts';

export function GithubTokenForm({ connect, token, setToken, working }: ConnectAccountDialogProps) {
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
}
