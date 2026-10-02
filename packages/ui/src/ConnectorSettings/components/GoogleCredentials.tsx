import { Input } from '@/components/ui/input/components/Input.tsx';
import type { GoogleCredentialsProps } from '@/ConnectorSettings/types.ts';

export function GoogleCredentials({
  clientId,
  setClientId,
  clientSecret,
  setClientSecret,
}: GoogleCredentialsProps) {
  return (
    <>
      <label>
        Google client ID
        <Input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          autoComplete="off"
          required
          maxLength={500}
          placeholder="…apps.googleusercontent.com"
        />
      </label>
      <label>
        Google client secret
        <Input
          type="password"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          autoComplete="off"
          maxLength={500}
        />
      </label>
    </>
  );
}
