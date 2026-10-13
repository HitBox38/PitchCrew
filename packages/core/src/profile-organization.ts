/** User-only explorer organization. Note identities and source paths stay stable. */
export interface ProfileOrganization {
  version: 1;
  folders: string[];
  locations: Record<string, string>;
}
