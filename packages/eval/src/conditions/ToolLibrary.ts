const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'the', 'this', 'into', 'each',
  'where', 'should', 'all', 'must', 'only', 'json', 'valid', 'output',
  'input', 'return', 'format', 'following', 'below', 'calculate', 'find'
]);

export function tokenizeDescription(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/[^a-z0-9_]/g, ' ');
  const tokens = normalized
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

export function computeDescriptionSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }
  // Cosine similarity between binary indicator vectors
  return intersectionCount / Math.sqrt(setA.size * setB.size);
}

export interface StoredTool {
  id: string;
  description: string;
  tokens: Set<string>;
  code: string;
  createdAt: number;
}

export class ToolLibrary {
  private tools: StoredTool[] = [];

  public reset(): void {
    this.tools = [];
  }

  public get size(): number {
    return this.tools.length;
  }

  public save(description: string, code: string): void {
    const tokens = tokenizeDescription(description);
    this.tools.push({
      id: `tool_${this.tools.length + 1}_${Date.now()}`,
      description,
      tokens,
      code,
      createdAt: Date.now(),
    });
  }

  /**
   * Retrieves the most semantically relevant tool by task description keyword similarity.
   * Does NOT use any task IDs, family IDs, or hidden test oracles.
   */
  public findSimilar(
    taskDescription: string,
    threshold = 0.25
  ): { code: string; score: number; description: string } | null {
    if (this.tools.length === 0) return null;

    const queryTokens = tokenizeDescription(taskDescription);
    let bestMatch: StoredTool | null = null;
    let highestScore = 0;

    for (const tool of this.tools) {
      const score = computeDescriptionSimilarity(queryTokens, tool.tokens);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = tool;
      }
    }

    if (bestMatch && highestScore >= threshold) {
      return {
        code: bestMatch.code,
        score: Number(highestScore.toFixed(3)),
        description: bestMatch.description,
      };
    }

    return null;
  }
}
