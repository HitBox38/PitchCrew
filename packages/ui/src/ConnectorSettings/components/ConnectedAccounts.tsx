import type { ConnectedAccountsProps } from '../types.ts';
import { AccountRow } from './AccountRow.tsx';

export const ConnectedAccounts = (model: ConnectedAccountsProps) => (
  <div className="account-installations">
    {model.data.connectors.map((connector) => (
      <AccountRow key={connector.id} connector={connector} {...model} />
    ))}
  </div>
);
