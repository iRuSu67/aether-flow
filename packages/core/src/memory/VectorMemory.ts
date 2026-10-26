/**
 * VectorMemory
 * High-performance in-memory vector store with cosine similarity,
 * semantic clustering, and deterministic embedding generation.
 */

export interface VectorRecord<T = Record<string, unknown>> {
  id: string;
  vector: number[];
  text: string;
  metadata: T;
  timestamp: number;
}

export interface SimilarityMatch<T = Record<string, unknown>> {
  record: VectorRecord<T>;
  score: number;
}

export class VectorMemory<T = Record<string, unknown>> {
  private records: Map<string, VectorRecord<T>> = new Map();
  private dimensions: number;

  constructor(dimensions = 64) {
    this.dimensions = dimensions;
  }

  /**
   * Deterministic, zero-dependency embedding generator (n-gram hashing + normalization).
   * Works offline with no external API calls required, or can accept externally supplied vectors.
   */
  public embed(text: string): number[] {
    const vector = new Array(this.dimensions).fill(0);
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter(Boolean);

    if (tokens.length === 0) return vector;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      // Compute token hash
      let hash = 0;
      for (let j = 0; j < token.length; j++) {
        hash = (hash << 5) - hash + token.charCodeAt(j);
        hash |= 0;
      }
      const idx = Math.abs(hash) % this.dimensions;
      vector[idx] += 1.0;

      // Bigram context
      if (i > 0) {
        const bigram = `${tokens[i - 1]}_${token}`;
        let bHash = 0;
        for (let k = 0; k < bigram.length; k++) {
          bHash = (bHash << 5) - bHash + bigram.charCodeAt(k);
          bHash |= 0;
        }
        const bIdx = Math.abs(bHash) % this.dimensions;
        vector[bIdx] += 0.5;
      }
    }

    // L2 Normalize
    let norm = 0;
    for (let i = 0; i < this.dimensions; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < this.dimensions; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }

  /**
   * Insert a document with automatic embedding
   */
  public insert(id: string, text: string, metadata: T, vector?: number[]): VectorRecord<T> {
    const v = vector || this.embed(text);
    const record: VectorRecord<T> = {
      id,
      vector: v,
      text,
      metadata,
      timestamp: Date.now(),
    };
    this.records.set(id, record);
    return record;
  }

  /**
   * Search for top-K most semantically similar documents
   */
  public search(query: string | number[], topK = 5, minScore = 0.0): SimilarityMatch<T>[] {
    const queryVector = Array.isArray(query) ? query : this.embed(query);
    const matches: SimilarityMatch<T>[] = [];

    for (const record of this.records.values()) {
      const score = this.cosineSimilarity(queryVector, record.vector);
      if (score >= minScore) {
        matches.push({ record, score });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, topK);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < this.dimensions; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  public size(): number {
    return this.records.size;
  }

  public clear(): void {
    this.records.clear();
  }
}
