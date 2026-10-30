import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { TokenUsage } from '../types.js';

export interface CacheEntry {
  key: string;
  text: string;
  tokens: TokenUsage;
  cachedAt: string;
}

export class ResponseCache {
  private cacheDir: string;
  public hits = 0;
  public misses = 0;

  constructor(cacheDir = '.eval_cache') {
    this.cacheDir = path.resolve(process.cwd(), cacheDir);
    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      } catch {
        // Ignore mkdir errors
      }
    }
  }

  public makeKey(
    provider: string,
    model: string,
    systemPrompt: string,
    prompt: string,
    thinkingLevel: string,
    runIndex: number
  ): string {
    const raw = `${provider}|${model}|${systemPrompt}|${prompt}|${thinkingLevel}|${runIndex}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  public get(key: string): { text: string; tokens: TokenUsage } | null {
    const filePath = path.join(this.cacheDir, `${key}.json`);
    if (!fs.existsSync(filePath)) {
      this.misses++;
      return null;
    }
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CacheEntry;
      this.hits++;
      return { text: data.text, tokens: data.tokens };
    } catch {
      this.misses++;
      return null;
    }
  }

  public set(key: string, text: string, tokens: TokenUsage): void {
    const filePath = path.join(this.cacheDir, `${key}.json`);
    const entry: CacheEntry = {
      key,
      text,
      tokens,
      cachedAt: new Date().toISOString(),
    };
    try {
      fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8');
    } catch (e) {
      console.error(`Failed to write cache entry ${key}:`, e);
    }
  }
}
