export interface IndexData {
  content_hash: string;
  structural_hash: string;
  status: 'Valid' | 'Invalidated';
  history: string[];
}
