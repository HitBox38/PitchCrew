export interface Claim {
  id: string;
  text: string;
  line: number;
  verdict: 'quoted' | 'revised';
  note: string;
  quote: string;
  draft?: string;
}
