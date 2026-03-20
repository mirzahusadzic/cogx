/**
 * Computes the cosine similarity between two vectors.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns The cosine similarity (value between -1 and 1, where 1 means identical direction)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Computes the normalized cosine similarity between two vectors,
 * mapping the result from [-1, 1] to [0, 1].
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Normalized cosine similarity (0 to 1)
 */
export function normalizedCosineSimilarity(a: number[], b: number[]): number {
  return (cosineSimilarity(a, b) + 1) / 2;
}
